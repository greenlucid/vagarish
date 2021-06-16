import Dispute from "../entities/Dispute"
import { MyContext } from "src/types"
import { Arg, Ctx, Field, InputType, Int, Query } from "type-graphql"
import Evidence from "../entities/Evidence"

@InputType()
class SearchInput {
  @Field()
  substring!: string

  @Field(() => [Int], { nullable: true })
  courtIds?: number[]
}

class SearchResolver {
  @Query(() => [Dispute])
  async search(
    @Ctx() { em }: MyContext,
    @Arg("options") options: SearchInput
  ): Promise<Dispute[]> {
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

    return matchedDisputes
  }
}

export default SearchResolver
