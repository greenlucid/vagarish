require("dotenv").config()

import { MikroORM } from "@mikro-orm/core"
import { ApolloServer } from "apollo-server-express"
import express from "express"
import { buildSchema } from "type-graphql"
import SearchResolver, { performSearch } from "./resolvers/search"
import Dispute from "./entities/Dispute"
import Evidence from "./entities/Evidence"
import { fetchAndStoreEvents, initDataToDb } from "./initialize"
import { CORS_OPTIONS } from "./constants"
import path from "path"
import Block from "./entities/Block"
import fs from "fs"

const randomBetween = (min: number, max: number) =>
  Math.floor(min + Math.random() * (max - min))

export const sleep = (seconds = 0): Promise<void> => {
  if (seconds === 0) seconds = randomBetween(2, 5)
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

const goodDirname = __dirname.slice(0, -5)

// to check if it's running init with /test
let updating = false

const main = async () => {
  const orm = await MikroORM.init({
    entities: [Dispute, Evidence, Block],
    dbName: "vagarish",
    type: "mongo",
    clientUrl: process.env.MONGO_URL || "mongodb://localhost:27017",
  })

  const app = express()

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [SearchResolver],
      validate: false,
    }),
    context: ({ req, res }) => ({ em: orm.em, req, res }),
  })

  app.use("/test", (_req, res) => res.json({ can: "can", updating }))

  app.use("/api/search", async (req, res) => {
    const substring = req.query.substring as string
    const klerosLiquidId = req.query.id as string
    const by = req.query.by as string
    const courtId = req.query.courtId as string
    const searchResults = await performSearch(orm.em, {
      substring,
      klerosLiquidId: parseInt(klerosLiquidId),
      by,
      courtId: parseInt(courtId),
    })
    res.json(searchResults)
  })

  apolloServer.applyMiddleware({ app, cors: CORS_OPTIONS })

  app.use("/.well-known/acme-challenge/:id", async (req, res) => {
    // hacky solution to get certbot to renew
    // certbot certonly -d vagarish.forer.es --webroot -w ./
    const id = req.params.id
    const challenge = fs.readFileSync(
      `.well-known/acme-challenge/${id}`,
      "utf-8"
    )
    res.send(challenge)
  })

  app.use(express.static("build"))
  app.get("*", (_req, res) => {
    res.sendFile(path.resolve(goodDirname, "build", "index.html"))
  })

  app.listen(process.env.PORT || 4000, () => {
    console.log(`server started on port ${process.env.PORT}`)
  })

  while (true) {
    updating = true
    await fetchAndStoreEvents()
    await initDataToDb(orm.em)
    updating = false
    await sleep(Number(process.env.UPDATE_TIME))
  }
}

main()
