import Dispute from "../entities/Dispute"
import { MyContext } from "src/types"
import { Arg, Ctx, Field, InputType, Int, Query } from "type-graphql"
import Evidence from "../entities/Evidence"
import SearchResult from "../entities/SearchResult"
import { EntityManager, Connection, IDatabaseDriver } from "@mikro-orm/core"

@InputType()
class SearchInput {
  @Field(() => String, { nullable: true })
  substring?: string

  @Field(() => Int, { nullable: true })
  klerosLiquidId?: number

  @Field(() => [Int], { nullable: true })
  courtIds?: number[]
}

const searchWithId = async (
  em: EntityManager<IDatabaseDriver<Connection>>,
  klerosLiquidId: number,
  substring?: string
): Promise<{ disputeList: Dispute[]; evidenceList: Evidence[] } | null> => {
  // first get the case
  const matchedDispute = await em.findOne(Dispute, {
    klerosLiquidId: klerosLiquidId.toString(),
  })
  if (!matchedDispute) return null

  // then get evidence
  if (substring) {
    const matchedEvidence = await em.find(Evidence, {
      $and: [
        {
          id: { $in: matchedDispute.evidenceIds },
        },
        {
          $or: [
            {
              textContent: { $re: substring },
            },
            {
              fileTextContent: { $re: substring },
            },
          ],
        },
      ],
    })
    return { disputeList: [matchedDispute], evidenceList: matchedEvidence }
  } else {
    const matchedEvidence = await em.find(Evidence, {
      id: { $in: matchedDispute.evidenceIds },
    })
    return { disputeList: [matchedDispute], evidenceList: matchedEvidence }
  }
}

const searchWithoutId = async (
  em: EntityManager<IDatabaseDriver<Connection>>,
  substring?: string
): Promise<{ disputeList: Dispute[]; evidenceList: Evidence[] } | null> => {
  if (!substring) return null
  const evidenceVariables = {
    $or: [
      {
        textContent: { $re: substring },
      },
      {
        fileTextContent: { $re: substring },
      },
    ],
  }
  const matchedEvidences = await em.find(Evidence, evidenceVariables)
  const disputeIds = matchedEvidences.map((evidence) => evidence.disputeId)

  const getDisputeVariables = () => {
    return {
      id: { $in: disputeIds },
    }
  }

  const disputeVariables = getDisputeVariables()

  const matchedDisputes = await em.find(Dispute, disputeVariables)
  return { disputeList: matchedDisputes, evidenceList: matchedEvidences }
}

const executeProperSearch = async (
  em: EntityManager<IDatabaseDriver<Connection>>,
  substring?: string,
  klerosLiquidId?: number
) => {
  if (klerosLiquidId) {
    return searchWithId(em, klerosLiquidId, substring)
  } else {
    return searchWithoutId(em, substring)
  }
}

export const performSearch = async (
  em: EntityManager<IDatabaseDriver<Connection>>,
  { substring, klerosLiquidId }: SearchInput
): Promise<SearchResult[]> => {
  const performSearchReturn = await executeProperSearch(
    em,
    substring,
    klerosLiquidId
  )
  if (!performSearchReturn) return []
  const { disputeList, evidenceList } = performSearchReturn

  // now that we got relevant info, filter it into SearchResults.
  const searchResultCores: SearchResult[] = disputeList.map((dispute) => ({
    id: dispute.id,
    klerosLiquidId: dispute.klerosLiquidId,
    arbitrable: dispute.arbitrable,
    matchedEvidence: [],
  }))
  // push evidence into result cores
  evidenceList.forEach((evidence) => {
    const searchResult = searchResultCores.find(
      (searchResult) => searchResult.id === evidence.disputeId
    ) as SearchResult
    searchResult.matchedEvidence.push(evidence)
  })

  return searchResultCores
}

class SearchResolver {
  @Query(() => [SearchResult])
  async search(
    @Ctx() { em }: MyContext,
    @Arg("options") options: SearchInput
  ): Promise<SearchResult[]> {
    return performSearch(em, options)
  }
}

export default SearchResolver
