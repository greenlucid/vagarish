require("dotenv").config()

import { MikroORM } from "@mikro-orm/core"
import { ApolloServer } from "apollo-server-express"
import express from "express"
import { buildSchema } from "type-graphql"
import SearchResolver, { performSearch } from "./resolvers/search"
import Dispute from "./entities/Dispute"
import Evidence from "./entities/Evidence"
import { fetchAndStoreEvents /*initDataToDb*/ } from "./initialize"
import { CORS_OPTIONS } from "./constants"
import path from "path"
import Block from "./entities/Block"
import fs from "fs"

const goodDirname = __dirname.slice(0, -5)

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

  app.use("/test", (_req, res) => res.json({ can: "can" }))

  app.use("/api/search", async (req, res) => {
    const substring = req.query.substring as string
    const klerosLiquidId = req.query.id as string
    const by = req.query.by as string
    const courtId = req.query.courtId as string    
    const searchResults = await performSearch(orm.em, {
      substring,
      klerosLiquidId: parseInt(klerosLiquidId),
      by,
      courtId: parseInt(courtId)
    })
    res.json(searchResults)
  })

  apolloServer.applyMiddleware({ app, cors: CORS_OPTIONS })

  app.use("/.well-known/acme-challenge/:id", async (req, res) => {
    // hacky solution to get certbot to renew
    // certbot certonly -d vagarish.forer.es --webroot -w ./
    const id = req.params.id
    const challenge = fs.readFileSync(`.well-known/acme-challenge/${id}`, "utf-8")
    res.send(challenge)
  })

  app.use(express.static("build"))
  app.get("*", (_req, res) => {
    res.sendFile(path.resolve(goodDirname, "build", "index.html"))
  })

  app.listen(process.env.PORT || 4000, () => {
    console.log(`server started on port ${process.env.PORT}`)
  })

  if (process.argv.length === 3 && process.argv[2] === "init") {
    await fetchAndStoreEvents()
    process.exit()
  }
}

main()
