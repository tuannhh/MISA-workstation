'use strict';

// W1.POLICY command/projection choke point. It is deliberately DB-agnostic so every vertical
// slice can use the same decisions before constructing SQL. Denials throw: callers must return
// 403, never silently strip sensitive writes.
const policy = require('./policy-engine');

class PolicyForbiddenError extends Error {
  constructor(reason = 'FORBIDDEN') { super(reason); this.name = 'PolicyForbiddenError'; this.code = 'POLICY_FORBIDDEN'; }
}

function ownerColumn(entity) { return entity === 'gift' ? 'responsible_user_id' : 'owner_id'; }

function createPolicyService({ visibilityStore }) {
  function forbidIf(condition, reason) { if (condition) throw new PolicyForbiddenError(reason); }
  function assertWritable({ principal, entity, action, record }) {
    forbidIf(!policy.canWrite({ principal, entity, action, record }), 'ACTION_DENIED');
  }
  function prepareCreate({ principal, entity, input }) {
    assertWritable({ principal, entity, action: 'create' });
    const out = { ...(input || {}) };
    const owner = ownerColumn(entity);
    // Provenance and ownership are server-derived, never accepted from client payload.
    forbidIf(Object.hasOwn(out, 'created_by'), 'CREATED_BY_IMMUTABLE');
    forbidIf(policy.isDirectEntity(entity) && Object.hasOwn(out, owner), 'OWNER_SERVER_ASSIGNED');
    out.created_by = principal.id;
    if (policy.isDirectEntity(entity)) out[owner] = principal.id;
    return out;
  }
  function prepareUpdate({ principal, entity, record, input }) {
    assertWritable({ principal, entity, action: 'edit', record });
    const out = { ...(input || {}) };
    const owner = ownerColumn(entity);
    forbidIf(Object.hasOwn(out, 'created_by'), 'CREATED_BY_IMMUTABLE');
    if (Object.hasOwn(out, owner)) forbidIf(!policy.isPrivileged(principal), 'OWNER_TRANSFER_ADMIN_ONLY');
    return out;
  }
  function projectRecord({ principal, entity, module, record }) {
    const output = {};
    for (const [field, value] of Object.entries(record || {})) {
      let isPublic = false;
      try { isPublic = !!visibilityStore?.isPublic(module, field); } catch { isPublic = false; }
      if (policy.canReadField({ principal, entity, field, record, isPublic })) output[field] = value;
    }
    return output;
  }
  return { assertWritable, prepareCreate, prepareUpdate, projectRecord };
}

module.exports = { PolicyForbiddenError, createPolicyService, ownerColumn };
