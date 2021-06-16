/*
  Intended to be called a single time.
  Gets all Kleros events in this order:
  1. Get all DisputeCreations.
    Get all distinct _arbitrables
  2. Load each _arbitrable as contract and get
    all Dispute and Evidence events in lists.
    Continue until all is fetched.
    (store these lists somewhere?)
  3. Persist data to the database.
    Get ipfs evidence. If evidence links to
    another ipfs, get it. Parse it. Transform
    pdfs into UTF-8 strings for db storage.
*/

import Web3 from "web3"
import { EntityManager, IDatabaseDriver, Connection } from "@mikro-orm/core"
import * as axios from "axios"

const Web3Launch = require("web3")
import * as fs from "fs"
import {
  DisputeCreationEvent,
  DisputeEvent,
  EvidenceEvent,
  IpfsEvidence,
} from "./types"
import Dispute from "./entities/Dispute"
import Evidence from "./entities/Evidence"
import { IPFS_ROOT } from "./constants"
import {
  download,
  ipfsEvidenceHasTextFile,
  parsePdf,
  parseTextContent,
} from "./utils"

const klerosLiquidABI = JSON.parse(
  fs.readFileSync("files/abis/KlerosLiquidABI.json", "utf-8")
)
const arbitrableABI = JSON.parse(
  fs.readFileSync("files/abis/ArbitrableABI.json", "utf-8")
)

const infuraUrl = "secret_infura_url"
const web3: Web3 = new Web3Launch(infuraUrl)
const klerosLiquidContractAddress = "0x988b3a538b618c7a603e1c11ab82cd16dbe28069"

const klerosLiquid = new web3.eth.Contract(
  klerosLiquidABI,
  klerosLiquidContractAddress
)

const getDisputeCreations = async () => {
  return klerosLiquid.getPastEvents("DisputeCreation", {
    fromBlock: 0,
    toBlock: "latest",
  })
}

const getArbitrableDisputeEvidence = async (arbitrableAddress: string) => {
  // if this arbitrableABI does not work
  // I will try to get the ABI through etherscan api
  // like this:
  // https://api.etherscan.io/api?module=contract&action=getabi&address=0xebcf3bca271b26ae4b162ba560e243055af0e679
  const arbitrableContract = new web3.eth.Contract(
    arbitrableABI,
    arbitrableAddress
  )
  const disputeEvents = await arbitrableContract.getPastEvents("Dispute", {
    fromBlock: 0,
    toBlock: "latest",
  })
  const evidenceEvents = await arbitrableContract.getPastEvents("Evidence", {
    fromBlock: 0,
    toBlock: "latest",
  })
  return { disputes: disputeEvents, evidences: evidenceEvents }
}

export const fetchAndStoreEvents = async () => {
  const allDisputeCreations =
    (await getDisputeCreations()) as DisputeCreationEvent[]
  fs.writeFileSync(
    "files/events/disputeCreations.json",
    JSON.stringify(allDisputeCreations),
    "utf-8"
  )
  const distinctArbitrables = allDisputeCreations
    .map((disputeCreation) => disputeCreation.returnValues._arbitrable)
    .reduce(
      (acc, item) => (acc.includes(item) ? acc : acc.concat(item)),
      [] as string[]
    )
  const arbitrableDatas = []
  let i: number
  for (i = 0; i < distinctArbitrables.length; i++) {
    const arbitrableData = await getArbitrableDisputeEvidence(
      distinctArbitrables[i]
    )
    arbitrableDatas.push(arbitrableData)
    console.log(`got ${i + 1} of ${distinctArbitrables.length}`)
  }
  fs.writeFileSync(
    "files/events/arbitrableDatas.json",
    JSON.stringify(arbitrableDatas),
    "utf-8"
  )
}

const createAndPersistDispute = (
  event: DisputeCreationEvent,
  em: EntityManager<IDatabaseDriver<Connection>>
) => {
  // cannot get courtId from disputeCreation event
  // almost can't get any planned info!
  const dispute = em.create(Dispute, {
    klerosLiquidId: event.returnValues._disputeID,
    arbitrable: event.returnValues._arbitrable,
    evidenceIds: [],
  })

  em.persist(dispute)
}

const mutateAndPersistDispute = async (
  event: DisputeEvent,
  em: EntityManager<IDatabaseDriver<Connection>>
) => {
  // adds evidenceGroup and metaEvidence IDs
  const dispute = (await em.findOne(Dispute, {
    klerosLiquidId: event.returnValues._disputeID,
  })) as Dispute
  dispute.evidenceGroupID = event.returnValues._evidenceGroupID
  dispute.metaEvidenceID = event.returnValues._metaEvidenceID
  em.persist(dispute)
}

const extractTextBasedFile = async (
  ipfsEvidence: IpfsEvidence
): Promise<string | undefined> => {
  // download file and get it in files/tempFile
  console.log("yo! appears we got a file.")
  console.log(ipfsEvidence)
  try {
    await download(`${IPFS_ROOT}${ipfsEvidence.fileURI}`, "files/tempFile")

    const file = fs.readFileSync("files/tempFile")

    const straightFormats = ["txt", "md"]
    if (straightFormats.includes(ipfsEvidence.fileTypeExtension as string)) {
      return file.toString()
    } else if (ipfsEvidence.fileTypeExtension === "pdf") {
      const parseResult = await parsePdf(file)
      if (parseResult === null) return undefined
      return parseResult
    } else {
      // then I don't know what format this is.
      console.log(
        `I cant parse this format "${ipfsEvidence.fileTypeExtension}"`
      )
      return undefined
    }
  } catch (e) {
    console.log("got another weird error")
    return undefined
  }
}

const mutateAndFlushEvidence = async (
  event: EvidenceEvent,
  em: EntityManager<IDatabaseDriver<Connection>>
) => {
  // this func takes a while
  // and there are a lot of these.
  const dispute = em.findOne(Dispute, {
    evidenceGroupID: event.returnValues._evidenceGroupID,
  })

  // while that resolves, do ipfs query
  // sometimes it starts with "ipfs" instead of "/ipfs/", messing with everything.
  const evidencePath =
    event.returnValues._evidence[0] === "/"
      ? event.returnValues._evidence
      : `/${event.returnValues._evidence}`
  try {
    const ipfsResponse = await axios.default.get(`${IPFS_ROOT}${evidencePath}`)
    let fileTextContent: string | undefined
    const ipfsEvidence = ipfsResponse.data as IpfsEvidence
    if (ipfsEvidenceHasTextFile(ipfsEvidence)) {
      fileTextContent = await extractTextBasedFile(ipfsEvidence)
    } else {
      fileTextContent = undefined
    }

    const awaitedDispute = await dispute
    if (awaitedDispute !== null) {
      const evidence = em.create(Evidence, {
        fileTextContent,
        textContent: parseTextContent(ipfsEvidence),
        hasFile: ipfsEvidenceHasTextFile(ipfsEvidence),
        disputeId: awaitedDispute.id,
      })
      await em.persistAndFlush(evidence)
      awaitedDispute.evidenceIds.push(evidence.id)
      await em.persistAndFlush(awaitedDispute)
    } else {
      console.log("No dispute holds that EvidenceGroupID")
      console.log(ipfsEvidence)
      console.log("Ignore and keep moving")
    }
  } catch (e) {
    console.log("Might have got error with the url")
    console.log(e)
    console.log("skipping something")
  }
}

export const initDataToDb = async (
  em: EntityManager<IDatabaseDriver<Connection>>
) => {
  await em.nativeDelete(Dispute, {})
  await em.nativeDelete(Evidence, {})

  const disputeCreations = JSON.parse(
    fs.readFileSync("files/events/disputeCreations.json", "utf-8")
  ) as DisputeCreationEvent[]
  const arbitrableDatas = JSON.parse(
    fs.readFileSync("files/events/arbitrableDatas.json", "utf-8")
  ) as { disputes: DisputeEvent[]; evidences: EvidenceEvent[] }[]

  disputeCreations.forEach((event) => createAndPersistDispute(event, em))
  await em.flush()

  const allDisputeEvents = arbitrableDatas
    .map((datas) => datas.disputes)
    .flat(2)

  let i: number
  for (i = 0; i < allDisputeEvents.length; i++) {
    await mutateAndPersistDispute(allDisputeEvents[i], em)
  }
  await em.flush()

  const allEvidenceEvents = arbitrableDatas
    .map((datas) => datas.evidences)
    .flat(2)

  for (i = 0; i < allEvidenceEvents.length; i++) {
    await mutateAndFlushEvidence(allEvidenceEvents[i], em)
    if (i % 100 === 0 || true) {
      console.log(`evidence n ${i} of ${allEvidenceEvents.length}`)
    }
  }
}
