import { EntityManager, IDatabaseDriver, Connection } from "@mikro-orm/core"
import { Response } from "express"

export interface MyContext {
  em: EntityManager<IDatabaseDriver<Connection>>
  res: Response
}

export interface EthEvent {
  address: string
  blockHash: string
  blockNumber: number
  logIndex: number
  removed: boolean
  transactionHash: string
  transactionIndex: number
  id: string
  event: string
  signature: string
  raw: {
    data: string
    topics: [string, string, string]
  }
}

export interface DisputeCreationEvent extends EthEvent {
  returnValues: {
    0: string
    1: string
    _disputeID: string
    _arbitrable: string
  }
}

export interface DisputeEvent extends EthEvent {
  returnValues: {
    0: string
    1: string
    2: string
    3: string
    _arbitrator: string
    _disputeID: string
    _metaEvidenceID: string
    _evidenceGroupID: string
  }
}

export interface EvidenceEvent extends EthEvent {
  returnValues: {
    0: string
    1: string
    2: string
    3: string
    _arbitrator: string
    _evidenceGroupID: string
    _party: string
    _evidence: string
  }
}

export interface IpfsEvidence {
  name?: string
  title?: string
  description: string
  fileURI?: string
  fileTypeExtension?: string
  evidenceSide?: number
}
