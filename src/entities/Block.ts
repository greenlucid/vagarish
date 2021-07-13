// just to store timestamps of blocks in db
// to avoid making 10k queries to infura every init

import { Field, Int, ObjectType } from "type-graphql"
import {
  Entity,
  PrimaryKey,
  Property,
  SerializedPrimaryKey,
} from "@mikro-orm/core"
import { ObjectId } from "@mikro-orm/mongodb"

@ObjectType()
@Entity()
class Block {
  @PrimaryKey()
  _id!: ObjectId

  @Field()
  @SerializedPrimaryKey()
  id!: string

  @Field(() => Int)
  @Property()
  blockNumber!: number

  @Field(() => Int)
  @Property()
  timestamp!: number
}

export default Block
