import { Field, Int, ObjectType } from "type-graphql"
import Evidence from "./Evidence"

@ObjectType()
class SearchResult {
  @Field()
  id!: string

  @Field()
  klerosLiquidId!: string

  @Field()
  arbitrable!: string

  @Field(() => [Evidence])
  matchedEvidence!: Evidence[]

  @Field(() => Int, { nullable: true })
  courtId?: number
}

export default SearchResult
