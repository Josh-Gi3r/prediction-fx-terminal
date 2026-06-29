/**
 * uuid_int composite construction for FX Provider Order / Intent structs.
 * Browser-compatible port of the FX provider market-maker uuid-int utility.
 *
 * Per FX Provider spec (256-bit layout, big-endian):
 *   [255:252] executor_id  (4 bits)   — from /health (mainnet default 0)
 *   [251:124] uuid bits    (128 bits) — UUID4 embedded
 *   [123:12]  group_id     (112 bits) — first 112 bits of order_id for standalone;
 *                                       shared across siblings in a VL batch.
 *   [11:0]    leg_id       (12 bits)  — 0 for standalone; 0,1,2,… for VL siblings.
 *
 * Mismatch between `order_id` (UUID4 string) and `uuid_int` is rejected by the FX provider.
 * Always build them together via makeOrderId() / makeVlSibling().
 */

export interface OrderIdPair {
  order_id: string; // UUID4 string
  uuid_int: string; // uint256 decimal
}

export const DEFAULT_EXECUTOR_ID = 0n;

function uuidToBits(uuid: string): bigint {
  return BigInt(`0x${uuid.replace(/-/g, "")}`);
}

function packUuidInt(executorId: bigint, uuidBits: bigint, groupId: bigint, legId: bigint): bigint {
  if (executorId < 0n || executorId > 0xfn) throw new Error("executorId must fit in 4 bits");
  if (uuidBits < 0n || uuidBits >= 1n << 128n) throw new Error("uuid must fit in 128 bits");
  if (groupId < 0n || groupId >= 1n << 112n) throw new Error("groupId must fit in 112 bits");
  if (legId < 0n || legId >= 1n << 12n) throw new Error("legId must fit in 12 bits");
  return (executorId << 252n) | (uuidBits << 124n) | (groupId << 12n) | legId;
}

/** Standalone order: leg_id=0, group_id = first 112 bits of the order_id. */
export function makeOrderId(executorId: bigint = DEFAULT_EXECUTOR_ID): OrderIdPair {
  const uuid = crypto.randomUUID();
  const uuidBits = uuidToBits(uuid);
  const groupId = uuidBits >> 16n; // first 112 of 128 high bits
  const legId = 0n;
  return { order_id: uuid, uuid_int: packUuidInt(executorId, uuidBits, groupId, legId).toString() };
}

/** VL sibling: shares the primary's group_id; leg_id increments 0,1,2,… */
export function makeVlSibling(
  primaryGroupId: bigint,
  legId: number,
  executorId: bigint = DEFAULT_EXECUTOR_ID,
): OrderIdPair {
  if (legId < 0 || legId > 4095) throw new Error(`legId out of range: ${legId}`);
  const uuid = crypto.randomUUID();
  const uuidBits = uuidToBits(uuid);
  return {
    order_id: uuid,
    uuid_int: packUuidInt(executorId, uuidBits, primaryGroupId, BigInt(legId)).toString(),
  };
}

/** Extract the group_id of an order_id, e.g. to seed VL siblings off the primary. */
export function groupIdFor(orderId: string): bigint {
  return uuidToBits(orderId) >> 16n;
}
