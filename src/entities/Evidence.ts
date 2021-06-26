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

  @Field(() => Boolean, { nullable: true })
  @Property()
  hasFile!: boolean

  @Field(() => String, { nullable: true })
  @Property()
  fileTextContent?: string

  @Field(() => String, { nullable: true })
  @Property()
  fileIpfsPath?: string

  @Field(() => String, { nullable: true })
  @Property()
  createdIn?: Date

  @Field(() => String)
  @Property()
  byAddress!: string

  // careful, this is the virtual mongodb id, not KlerosLiquid's disputeId
  @Property()
  disputeId!: string
}

export default Evidence
