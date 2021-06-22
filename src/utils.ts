import { IpfsEvidence } from "./types"
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
  return `${ipfsEvidence.name ? ipfsEvidence.name : ""}\n${
    ipfsEvidence.title ? ipfsEvidence.title : ""
  }\n${ipfsEvidence.description}`
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
  // _evidence is even a field that should be trusted
  // format is like /ipfs/adfdsafasdfkjasdfkjlasdf/thing.json
  // will allow not starting with a slash
  const format = /^\/?ipfs\/[a-zA-Z0-9]{46}\//
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
