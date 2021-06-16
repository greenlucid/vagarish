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
class Dispute {
  @PrimaryKey()
  _id!: ObjectId

  @Field()
  @SerializedPrimaryKey()
  id!: string

  // the int id given by KlerosLiquid
  @Field(() => Int)
  @Property()
  klerosLiquidId!: number

  @Field(() => Int)
  @Property()
  courtId!: number

  @Field(() => [String])
  evidenceIds!: string[]

  @Field()
  @Property()
  createdBy!: string

  @Field(() => String)
  @Property()
  createdIn!: Date
}

export default Dispute
