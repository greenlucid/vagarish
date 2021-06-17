import Dispute from "../entities/Dispute"
import { MyContext } from "src/types"
import { Arg, Ctx, Field, InputType, Int, Query } from "type-graphql"
import Evidence from "../entities/Evidence"
import SearchResult from "../entities/SearchResult"

@InputType()
class SearchInput {
  @Field()
  substring!: string

  @Field(() => [Int], { nullable: true })
  courtIds?: number[]
}

class SearchResolver {
  @Query(() => [SearchResult])
  async search(
    @Ctx() { em }: MyContext,
    @Arg("options") options: SearchInput
  ): Promise<SearchResult[]> {
    const evidenceVariables = {
      $or: [
        {
          textContent: { $re: options.substring },
        },
        {
          fileTextContent: { $re: options.substring },
        },
      ],
    }
    const matchedEvidences = await em.find(Evidence, evidenceVariables)
    const disputeIds = matchedEvidences.map((evidence) => evidence.disputeId)

    const getDisputeVariables = () => {
      if (options.courtIds) {
        return {
          $and: [
            {
              id: { $in: disputeIds },
            },
            {
              courtId: { $in: options.courtIds },
            },
          ],
        }
      } else {
        return {
          id: { $in: disputeIds },
        }
      }
    }

    const disputeVariables = getDisputeVariables()

    const matchedDisputes = await em.find(Dispute, disputeVariables)
    // now that we got relevant info, filter it into SearchResults.
    const searchResultCores: SearchResult[] = matchedDisputes.map(
      (dispute) => ({
        id: dispute.id,
        klerosLiquidId: dispute.klerosLiquidId,
        arbitrable: dispute.arbitrable,
        matchedEvidence: [],
      })
    )
    // push evidence into result cores
    matchedEvidences.forEach((evidence) => {
      const searchResult = searchResultCores.find(
        (searchResult) => searchResult.id === evidence.disputeId
      ) as SearchResult
      searchResult.matchedEvidence.push(evidence)
    })

    return searchResultCores
  }
}

export default SearchResolver
