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
  @Field(() => String)
  @Property()
  klerosLiquidId!: string

  @Field(() => [String])
  @Property()
  evidenceIds!: string[]

  @Field(() => String)
  @Property()
  arbitrable!: string

  @Field(() => String, { nullable: true })
  @Property()
  evidenceGroupID?: string

  @Field(() => String, { nullable: true })
  @Property()
  metaEvidenceID?: string

  @Field(() => Int, { nullable: true })
  @Property()
  courtId?: number

  @Field(() => String, { nullable: true })
  @Property()
  createdBy?: string

  @Field(() => String, { nullable: true })
  @Property()
  createdIn?: Date
}

export default Dispute
