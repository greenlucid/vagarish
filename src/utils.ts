import { IpfsEvidence } from "./types"
import pdfParse from "pdf-parse"

const understoodFormats = ["pdf", "txt", "md"]

export const ipfsEvidenceHasTextFile = (ipfsEvidence: IpfsEvidence) => {
  return (
    ipfsEvidence.fileURI &&
    ipfsEvidence.fileURI.length > 0 &&
    understoodFormats.includes(ipfsEvidence.fileTypeExtension as string)
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
        fs.unlinkSync(filePath)
        const file = fs.createWriteStream(filePath, { flags: "wx" })
        res
          .on("end", () => {
            file.end()
            // console.log(`${uri.pathname} downloaded to: ${path}`)
            resolve()
          })
          .on("error", (err) => {
            file.destroy()
            fs.unlink(filePath, () => reject(err))
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
        .catch((e) => {
          console.log("got error")
          console.log(e)
          resolve(null)
        })
    }
  )

  return parsePdfPromise
}
