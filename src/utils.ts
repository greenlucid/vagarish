import { IpfsEvidence } from "./types"
import { Contract, EventData } from "web3-eth-contract"
import pdfParse from "pdf-parse"

const understoodFormats = ["pdf", "txt", "md"]

export const ipfsEvidenceHasTextFile = (ipfsEvidence: IpfsEvidence) => {
  return (
    ipfsEvidence.fileURI &&
    ipfsEvidence.fileURI.length > 0 &&
    understoodFormats.includes(ipfsEvidence.fileTypeExtension as string) &&
    getHashFromIpfs(ipfsEvidence.fileURI) !== null
  )
}

export const parseTextContent = (ipfsEvidence: IpfsEvidence) => {
  return `${ipfsEvidence.name ? ipfsEvidence.name : ""}\n${ipfsEvidence.title ? ipfsEvidence.title : ""
    }\n${ipfsEvidence.description || ""}`
}

// download.js
import fs from "fs"
import https from "https"
import http from "http"
import { basename } from "path"
import { URL } from "url"

// thanks https://stackoverflow.com/a/66507546/15623042
export const download = (url: string, filePath: string): Promise<void> => {
  const uri = new URL(url)
  if (!filePath) {
    filePath = basename(uri.pathname)
  }
  const pkg = url.toLowerCase().startsWith("https:") ? https : http

  return new Promise((resolve, reject) => {
    pkg.get(uri.href).on("response", (res) => {
      if (res.statusCode === 200) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
        const file = fs.createWriteStream(filePath, { flags: "wx" })
        res
          .on("end", () => {
            file.end()
            // console.log(`${uri.pathname} downloaded to: ${path}`)
            resolve()
          })
          .on("error", (err) => {
            file.destroy()
            if (fs.existsSync(filePath)) {
              fs.unlink(filePath, () => reject(err))
            }
          })
          .pipe(file)
      } else {
        reject(
          new Error(
            `Download request failed, response status: ${res.statusCode} ${res.statusMessage}`
          )
        )
      }
    })
  })
}

// lost much time on this, didn't get it to work 100% of the time.
export const parsePdf = async (pdfFile: Buffer): Promise<string | null> => {
  const parsePdfPromise = new Promise(
    (resolve: (value: string | null) => void) => {
      pdfParse(pdfFile)
        .then((data) => resolve(data.text))
        .catch((_e) => {
          resolve(null)
        })
    }
  )

  return parsePdfPromise
}

export const getHashFromIpfs = (uri: string): string | null => {
  // _evidence is not a field that should be trusted
  // format is like /ipfs/adfdsafasdfkjasdfkjlasdf/thing.json
  const format = /^\/ipfs\/[a-zA-Z0-9]{46}\//
  if (!format.test(uri)) {
    return null
  }
  // ipfs/ is 5 chars long, that's why there's a 5
  const firstPoint = uri.indexOf("ipfs") + 5
  // increment by firstPoint because you get the index of the sliced string!
  // e.g. it's shorter now so you'd miss some of the hash
  const secondPoint = uri.slice(firstPoint).indexOf("/") + firstPoint
  const hash = uri.slice(firstPoint, secondPoint)
  return hash
}

export const getAllPastEvents = async (
  contract: Contract,
  eventName: string,
  startBlock: number,
  lastBlock: number
): Promise<EventData[]> => {
  // bypasses infura 10000 result limit with recursion
  // make request
  try {
    const events = await contract.getPastEvents(eventName, {
      fromBlock: startBlock,
      toBlock: lastBlock,
    })
    return events
  } catch (error) {
    if (error instanceof Error && /query returned more than 10000 results/.test(error.message)) {
      // find a middle point between startBlock and lastBlock
      // call two separate getAllPastEvents and await them, then return both concat.
      const middlePoint = Math.floor((startBlock + lastBlock) / 2)
      console.log(
        `too many. will get from ${startBlock}->${middlePoint} and ${middlePoint + 1
        }->${lastBlock}`
      )
      const firstHalf = await getAllPastEvents(
        contract,
        eventName,
        startBlock,
        middlePoint
      )
      const secondHalf = await getAllPastEvents(
        contract,
        eventName,
        middlePoint + 1,
        lastBlock
      )
      console.log("my halves:", firstHalf.length, secondHalf.length)
      let concatThing
      try {
        concatThing = firstHalf.concat(secondHalf)
      } catch (error) {
        console.log("got the concat of null error.", firstHalf.length, secondHalf.length, { contract, eventName, startBlock, lastBlock })
        return []
      }
    } else {
      console.log(
        "Got an error that is not 'more than 10000 results', throwing it..."
      )
      throw error
    }
  }
  // this code path should not be reachable, just to shut up ts
  return []
}
