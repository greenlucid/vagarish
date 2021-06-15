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
class Case {
  @PrimaryKey()
  _id!: ObjectId

  @Field()
  @SerializedPrimaryKey()
  id!: string

  @Field(() => Int)
  @Property()
  caseId!: number

  @Field(() => Int)
  @Property()
  courtId!: number

  @Field()
  @Property()
  textContent!: string

  @Field(() => [String])
  evidenceIds!: string[]

  @Field()
  @Property()
  createdBy!: string

  @Field(() => String)
  @Property()
  createdIn!: Date
}

export default Case
