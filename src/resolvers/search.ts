import Dispute from "../entities/Dispute"
import { MyContext } from "src/types"
import { Arg, Ctx, Field, InputType, Int, Query } from "type-graphql"
import Evidence from "../entities/Evidence"
import SearchResult from "../entities/SearchResult"
import {
  EntityManager,
  Connection,
  IDatabaseDriver,
  FilterQuery,
} from "@mikro-orm/core"

@InputType()
class SearchInput {
  @Field(() => String, { nullable: true })
  substring?: string

  @Field(() => Int, { nullable: true })
  klerosLiquidId?: number

  @Field(() => String, {nullable: true})
  by?: string

  @Field(() => Int, {nullable: true})
  courtId?: number
}

const searchWithId = async (
  em: EntityManager<IDatabaseDriver<Connection>>,
  klerosLiquidId: number,
  substring?: string,
  by?: string
): Promise<{ disputeList: Dispute[]; evidenceList: Evidence[] } | null> => {
  // first get the case
  
  const matchedDispute = await em.findOne(Dispute, {
    klerosLiquidId: klerosLiquidId.toString()
  })
  if (!matchedDispute) return null

  // then get evidence
  const getEvidenceVariables = () => {
    if (!by && !substring) {
      return { id: { $in: matchedDispute.evidenceIds } }
    } else if (by && !substring) {
      return {
        $and: [{ id: { $in: matchedDispute.evidenceIds } }, { byAddress: by }],
      }
    } else if (!by && substring) {
      return {
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
      }
    } else {
      return {
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
          { byAddress: by },
        ],
      }
    }
  }
  const evidenceVariables = getEvidenceVariables()
  const matchedEvidence = await em.find(
    Evidence,
    evidenceVariables as FilterQuery<Evidence>
  )
  return { disputeList: [matchedDispute], evidenceList: matchedEvidence }
}

const searchWithoutId = async (
  em: EntityManager<IDatabaseDriver<Connection>>,
  substring?: string,
  by?: string,
  courtId?: number
): Promise<{ disputeList: Dispute[]; evidenceList: Evidence[] } | null> => {
  if (!substring && !by && courtId == undefined) return null
  const querySubstring = substring ? substring : ""
  const getEvidenceVariables = () => {
    if (!by) {
      return {
        $or: [
          {
            textContent: { $re: querySubstring },
          },
          {
            fileTextContent: { $re: querySubstring },
          },
        ],
      }
    } else {
      return {
        $and: [
          { byAddress: by },
          {
            $or: [
              {
                textContent: { $re: querySubstring },
              },
              {
                fileTextContent: { $re: querySubstring },
              },
            ],
          },
        ],
      }
    }
  }
  const evidenceVariables = getEvidenceVariables()
  const matchedEvidences = await em.find(Evidence, evidenceVariables)
  const disputeIds = matchedEvidences.map((evidence) => evidence.disputeId)

  const getDisputeVariables = () => {
    if (courtId != null || courtId != undefined) {
      return {
        courtId: courtId,
        id: { $in: disputeIds }
      }
    }
    else {
      return {
        id: { $in: disputeIds }
      }
    }
  }

  const disputeVariables = getDisputeVariables()

  const matchedDisputes = await em.find(Dispute, disputeVariables)
  return { disputeList: matchedDisputes, evidenceList: matchedEvidences }
}

const executeProperSearch = async (
  em: EntityManager<IDatabaseDriver<Connection>>,
  substring?: string,
  klerosLiquidId?: number,
  by?: string,
  courtId?: number
) => {
  if (klerosLiquidId) {
    return searchWithId(em, klerosLiquidId, substring, by)
  } else {
    return searchWithoutId(em, substring, by, courtId)
  }
}

export const performSearch = async (
  em: EntityManager<IDatabaseDriver<Connection>>,
  { substring, klerosLiquidId, by, courtId }: SearchInput
): Promise<SearchResult[]> => {
  const performSearchReturn = await executeProperSearch(
    em,
    substring,
    klerosLiquidId,
    by,
    courtId
  )
  if (!performSearchReturn) return []
  const { disputeList, evidenceList } = performSearchReturn

  // now that we got relevant info, filter it into SearchResults.
  const searchResultCores: SearchResult[] = disputeList.map((dispute) => ({
    id: dispute.id,
    klerosLiquidId: dispute.klerosLiquidId,
    arbitrable: dispute.arbitrable,
    courtId: dispute.courtId,
    matchedEvidence: [],
  }))
  // push evidence into result cores
  evidenceList.forEach((evidence) => {
    const searchResult = searchResultCores.find(
      (searchResult) => searchResult.id === evidence.disputeId
    )
    if (searchResult) searchResult.matchedEvidence.push(evidence)
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
