import Case from "../entities/Case"
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
  @Query(() => [Case])
  async search(
    @Ctx() { em }: MyContext,
    @Arg("options") options: SearchInput
  ): Promise<Case[]> {
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
    const caseIds = matchedEvidences.map((evidence) => evidence.caseId)

    const caseVariables = {
      $or: [
        {
          textContent: { $re: options.substring },
        },
        {
          id: { $in: caseIds },
        },
      ],
    }

    const matchedCases = await em.find(Case, caseVariables)

    return matchedCases
  }
}

export default SearchResolver
