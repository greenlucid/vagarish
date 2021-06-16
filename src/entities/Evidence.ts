import { Field, ObjectType } from "type-graphql"
import {
  Entity,
  PrimaryKey,
  Property,
  SerializedPrimaryKey,
} from "@mikro-orm/core"
import { ObjectId } from "@mikro-orm/mongodb"

@ObjectType()
@Entity()
class Evidence {
  @PrimaryKey()
  _id!: ObjectId

  @Field()
  @SerializedPrimaryKey()
  id!: string

  @Field()
  @Property()
  textContent!: string

  @Field()
  @Property()
  hasFile!: boolean

  @Field(() => String, { nullable: true })
  @Property()
  fileTextContent?: string

  @Field(() => String, { nullable: true })
  @Property()
  createdIn?: Date

  // careful, this is the virtual mongodb id, not KlerosLiquid's disputeId
  @Field(() => String)
  @Property()
  disputeId!: string
}

export default Evidence
