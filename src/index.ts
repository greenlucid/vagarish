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

const main = async () => {
  const orm = await MikroORM.init({
    entities: [Dispute, Evidence],
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
    const searchResults = await performSearch(orm.em, {
      substring,
      klerosLiquidId: parseInt(klerosLiquidId),
    })
    res.json(searchResults)
  })

  apolloServer.applyMiddleware({ app, cors: CORS_OPTIONS })

  app.use(express.static("build"))

  app.listen(process.env.PORT || 4000, () => {
    console.log(`server started on port ${process.env.PORT}`)
  })

  if (process.argv.length === 3 && process.argv[2] === "init") {
    await fetchAndStoreEvents()
    await initDataToDb(orm.em)
  }
}

main()
