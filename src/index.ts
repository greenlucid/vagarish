import { MikroORM } from "@mikro-orm/core"
import { ApolloServer } from "apollo-server-express"
import express from "express"
import { buildSchema } from "type-graphql"
import http from "http"
import SearchResolver from "./resolvers/search"
import Case from "./entities/Case"
import Evidence from "./entities/Evidence"

const main = async () => {
  const orm = await MikroORM.init({
    entities: [Case, Evidence],
    dbName: "vagarish",
    type: "mongo",
    clientUrl: "mongodb://localhost:27017",
  })

  const app = express()

  const corsOptions = {
    origin: "http://192.168.1.43:3000",
    credentials: true,
  }

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [SearchResolver],
      validate: false,
    }),
    context: ({ req, res }) => ({ em: orm.em, req, res }),
  })

  app.use("/test", (_req, res) => res.json({ can: "can" }))

  const httpServer = http.createServer(app)

  apolloServer.applyMiddleware({ app, cors: corsOptions })

  httpServer.listen(4000, () => {
    console.log("server started on 192.168.1.43:4000")
  })
}

main()
