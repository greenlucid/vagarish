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

  @Field(() => String)
  @Property()
  createdIn!: Date

  @Field(() => String)
  @Property()
  caseId!: string
}

export default Evidence
