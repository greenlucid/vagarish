import { EntityManager, IDatabaseDriver, Connection } from "@mikro-orm/core"
import { Response } from "express"

export interface MyContext {
  em: EntityManager<IDatabaseDriver<Connection>>
  res: Response
}

