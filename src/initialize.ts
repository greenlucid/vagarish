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
import axios from "axios"

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
  getHashFromIpfs,
  ipfsEvidenceHasTextFile,
  parsePdf,
  parseTextContent,
} from "./utils"
import path from "path"

const goodDirname = __dirname.slice(0, -5)

const klerosLiquidABI = JSON.parse(
  fs.readFileSync(
    path.join(goodDirname, "files/abis/KlerosLiquidABI.json"),
    "utf-8"
  )
)
const arbitrableABI = JSON.parse(
  fs.readFileSync(
    path.join(goodDirname, "files/abis/ArbitrableABI.json"),
    "utf-8"
  )
)

const infuraUrl = process.env.INFURA_URL

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
    path.join(goodDirname, "files/events/disputeCreations.json"),
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
    path.join(goodDirname, "files/events/arbitrableDatas.json"),
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
): Promise<string | null> => {
  // download file and get it in files/tempFile
  console.log("Extracting text...")
  try {
    await download(
      `${IPFS_ROOT}${ipfsEvidence.fileURI}`,
      path.join(goodDirname, "files/tempFile")
    )

    const file = fs.readFileSync(path.join(goodDirname, "files/tempFile"))

    const straightFormats = ["txt", "md"]
    if (straightFormats.includes(ipfsEvidence.fileTypeExtension as string)) {
      return file.toString()
    } else if (ipfsEvidence.fileTypeExtension === "pdf") {
      const parseResult = await parsePdf(file)
      if (parseResult === null) return null
      return parseResult
    } else {
      // then I don't know what format this is.
      console.log(
        `I cant parse this format "${ipfsEvidence.fileTypeExtension}"`
      )
      return null
    }
  } catch (e) {
    console.log("got another weird error")
    return null
  }
}

const downloadEvidence = async (
  event: EvidenceEvent
): Promise<IpfsEvidence | null> => {
  try {
    const ipfsResponse = await axios.get(
      `${IPFS_ROOT}${event.returnValues._evidence}`
    )
    const ipfsEvidence = ipfsResponse.data as IpfsEvidence
    return ipfsEvidence
  } catch (e) {
    console.log("Error downloading evidence. Event was:")
    console.log(event)
    console.log("Error was:")
    console.log(e)
    return null
  }
}

const storeEvidence = (event: EvidenceEvent, ipfsEvidence: IpfsEvidence) => {
  fs.writeFileSync(
    path.join(
      goodDirname,
      `files/ipfs/${getHashFromIpfs(event.returnValues._evidence)}`
    ),
    JSON.stringify(ipfsEvidence)
  )
}

const storeTextFile = (ipfsEvidence: IpfsEvidence, fileText: string) => {
  fs.writeFileSync(
    path.join(
      goodDirname,
      `files/ipfs/${getHashFromIpfs(ipfsEvidence.fileURI as string)}`
    ),
    fileText
  )
}

const evidenceRoutine = async (
  event: EvidenceEvent
): Promise<{
  evidence: IpfsEvidence
  fileTextContent: string | null | undefined
} | null> => {
  //0. abort if hash cannot be retrieved.
  if (getHashFromIpfs(event.returnValues._evidence) === null) {
    console.log(
      `_evidence does not match format. got ${event.returnValues._evidence}`
    )
    return null
  }

  //1. check if evidence is stored. If stored, goto 3.
  let ipfsEvidence: IpfsEvidence | null = null
  const evidenceChosenPath = path.join(
    goodDirname,
    `files/ipfs/${getHashFromIpfs(event.returnValues._evidence)}`
  )
  if (!fs.existsSync(evidenceChosenPath)) {
    //2. Download evidence.
    ipfsEvidence = await downloadEvidence(event)
    if (ipfsEvidence === null) {
      // then skip this evidence.
      return null
    }
    storeEvidence(event, ipfsEvidence)
  } else {
    // it existed, so we take it.
    ipfsEvidence = JSON.parse(fs.readFileSync(evidenceChosenPath, "utf-8"))
  }
  const sureEvidence = ipfsEvidence as IpfsEvidence

  //3. check if there is a textFile.
  if (ipfsEvidenceHasTextFile(sureEvidence)) {
    //4. if there is, check if is downloaded. if it is, goto 6.
    const textFileChosenPath = path.join(
      goodDirname,
      `files/ipfs/${getHashFromIpfs(sureEvidence.fileURI as string)}`
    )
    if (!fs.existsSync(textFileChosenPath)) {
      //5. download and parse
      const textContent = await extractTextBasedFile(sureEvidence)
      if (textContent === null) {
        console.log("Error on parsing text file, got nullified")
        return { evidence: sureEvidence, fileTextContent: null }
      }
      storeTextFile(sureEvidence, textContent)
      return { evidence: sureEvidence, fileTextContent: textContent }
    } else {
      // it did exist, so we take it.
      const textContent = fs.readFileSync(textFileChosenPath, "utf-8") as string
      return { evidence: sureEvidence, fileTextContent: textContent }
    }
  }
  // there is no file at all!
  return { evidence: sureEvidence, fileTextContent: undefined }
}

const mutateAndFlushEvidence = async (
  event: EvidenceEvent,
  em: EntityManager<IDatabaseDriver<Connection>>
) => {
  // this func takes a while
  // and there are a lot of these.
  const dispute = em.findOne(Dispute, {
    evidenceGroupID: event.returnValues._evidenceGroupID,
    arbitrable: event.address,
  })

  // while that resolves, do ipfs query
  const evidenceRoutineReturn = await evidenceRoutine(event)
  if (evidenceRoutineReturn !== null) {
    const { evidence: ipfsEvidence, fileTextContent } =
      evidenceRoutineReturn as {
        evidence: IpfsEvidence
        fileTextContent: string | null | undefined
      }
    const awaitedDispute = await dispute
    if (awaitedDispute !== null) {
      const evidence = em.create(Evidence, {
        fileTextContent,
        textContent: parseTextContent(ipfsEvidence),
        hasFile: ipfsEvidenceHasTextFile(ipfsEvidence),
        disputeId: awaitedDispute.id,
        fileIpfsPath:
          // only include if it's a string and the format is non-null
          ipfsEvidence.fileURI && getHashFromIpfs(ipfsEvidence.fileURI)
            ? ipfsEvidence.fileURI
            : null,
      })
      await em.persistAndFlush(evidence)
      awaitedDispute.evidenceIds.push(evidence.id)
      await em.persistAndFlush(awaitedDispute)
    } else {
      console.log("No dispute holds that EvidenceGroupID")
    }
  } else {
    console.log("Evidence Routine went null. Skipping...")
  }
}

export const initDataToDb = async (
  em: EntityManager<IDatabaseDriver<Connection>>
) => {
  await em.nativeDelete(Dispute, {})
  await em.nativeDelete(Evidence, {})

  const disputeCreations = JSON.parse(
    fs.readFileSync(
      path.join(goodDirname, "files/events/disputeCreations.json"),
      "utf-8"
    )
  ) as DisputeCreationEvent[]
  const arbitrableDatas = JSON.parse(
    fs.readFileSync(
      path.join(goodDirname, "files/events/arbitrableDatas.json"),
      "utf-8"
    )
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
