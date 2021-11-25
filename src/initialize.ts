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
  getAllPastEvents,
  getHashFromIpfs,
  ipfsEvidenceHasTextFile,
  parsePdf,
  parseTextContent,
} from "./utils"
import path from "path"
import Block from "./entities/Block"

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

const getArbitrableDisputeEvidence = async (
  arbitrableAddress: string,
  currentBlockNumber: number,
  shitflag: boolean
) => {
  const arbitrableContract = new web3.eth.Contract(
    arbitrableABI,
    arbitrableAddress
  )

  const disputeEvents = await getAllPastEvents(
    arbitrableContract,
    "Dispute",
    0,
    currentBlockNumber
  )

  const evidenceEvents = await getAllPastEvents(
    arbitrableContract,
    "Evidence",
    0,
    currentBlockNumber
  )
  if (shitflag) {
    console.log(evidenceEvents)
  }
  return { disputes: disputeEvents, evidences: evidenceEvents }
}

const getDisputeToSubcourtIdArray = async (disputeCount: number) => {
  // This func takes a few minutes
  let i = 0;
  const subcourtIds: number[] = []
  for (; i < disputeCount; i++) {
    const dispute = await klerosLiquid.methods.disputes(i).call()
    subcourtIds[i] = Number(dispute.subcourtID)
    console.log(`dispute to court: got ${i} of ${disputeCount - 1}`)
  }
  return subcourtIds;
}

export const fetchAndStoreEvents = async () => {
  const currentBlockNumber = await web3.eth.getBlockNumber()

  const allDisputeCreations =
    (await getDisputeCreations()) as DisputeCreationEvent[]
  fs.writeFileSync(
    path.join(goodDirname, "files/events/disputeCreations.json"),
    JSON.stringify(allDisputeCreations),
    "utf-8"
  )

  // check if disputeToSubourtId update is needed
  const previousDisputeToSubcourt = JSON.parse(fs.readFileSync(
    path.join(goodDirname, "files/events/subcourtIds.json"),
    "utf-8"
  ))

  if (previousDisputeToSubcourt.length !== allDisputeCreations.length) {
    const subcourtIds = await getDisputeToSubcourtIdArray(allDisputeCreations.length)
    fs.writeFileSync(
      path.join(goodDirname, "files/events/subcourtIds.json"),
      JSON.stringify(subcourtIds),
      "utf-8"
    )
  } else {
    console.log("there's no need to update disputeToSubcourtId array")
  }

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
      distinctArbitrables[i],
      currentBlockNumber,
      i === 32
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
  subcourtId: number,
  em: EntityManager<IDatabaseDriver<Connection>>
) => {
  // cannot get courtId from disputeCreation event
  // almost can't get any planned info!
  const dispute = em.create(Dispute, {
    klerosLiquidId: event.returnValues._disputeID,
    arbitrable: event.returnValues._arbitrable,
    evidenceIds: [],
    courtId: subcourtId
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

const getBlockTimestamp = async (
  blockNumber: number,
  em: EntityManager<IDatabaseDriver<Connection>>
): Promise<number> => {
  // try to get it off db.
  const dbBlock = await em.findOne(Block, { blockNumber })
  if (dbBlock === null) {
    // wasn't found in db, fetch from infura and save in db.
    const block = await web3.eth.getBlock(blockNumber)
    const newBlock = em.create(Block, {
      blockNumber,
      timestamp: block.timestamp,
    })
    await em.persistAndFlush(newBlock)
    return block.timestamp as number
  } else {
    return dbBlock.timestamp
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
    const timestamp = await getBlockTimestamp(event.blockNumber, em)
    if (awaitedDispute !== null) {
      const evidence = em.create(Evidence, {
        fileTextContent,
        textContent: parseTextContent(ipfsEvidence),
        hasFile: ipfsEvidenceHasTextFile(ipfsEvidence),
        disputeId: awaitedDispute.id,
        byAddress: event.returnValues._party,
        timestamp,
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

  const subcourtIds = JSON.parse(
    fs.readFileSync(
      path.join(goodDirname, "files/events/subcourtIds.json"),
      "utf-8"
    )
  ) as number[]

  const arbitrableDatas = JSON.parse(
    fs.readFileSync(
      path.join(goodDirname, "files/events/arbitrableDatas.json"),
      "utf-8"
    )
  ) as { disputes: DisputeEvent[]; evidences: EvidenceEvent[] }[]

  disputeCreations.forEach(
    (event) => createAndPersistDispute(event, subcourtIds[Number(event.returnValues._disputeID)], em)
  )
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
