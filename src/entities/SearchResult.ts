import { Field, ObjectType } from "type-graphql"
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
}

export default SearchResult
