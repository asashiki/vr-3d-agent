(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PocketWorld = Object.assign(root.PocketWorld || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const EMOTIONS = ['neutral','happy','sad','angry','surprised'];

  class AgentLoop {
    constructor({ planner, tools, maxCommands = 14, maxRepairs = 2, onPhase } = {}) {
      if (!planner || !tools) throw new TypeError('planner and tools are required');
      this.planner = planner;
      this.tools = tools;
      this.maxCommands = maxCommands;
      this.maxRepairs = maxRepairs;
      this.onPhase = onPhase || (() => {});
    }
    phase(name, detail) { this.onPhase({ at: new Date().toISOString(), phase: name, detail }); }
    validatePlan(plan) {
      if (!plan || typeof plan !== 'object' || !Array.isArray(plan.commands)) throw new Error('INVALID_PLAN');
      if (plan.commands.length > this.maxCommands) throw new Error('COMMAND_BUDGET_EXCEEDED');
      return {
        say: String(plan.say || '').slice(0, 280),
        emotion: EMOTIONS.includes(plan.emotion) ? plan.emotion : 'neutral',
        avatarAction: String(plan.avatarAction || 'Thinking'),
        commands: plan.commands.map((command) => ({ ...command }))
      };
    }
    async run(text) {
      this.phase('Understand', { text });
      let attempt = 0, errors = [], plan;
      while (attempt <= this.maxRepairs) {
        this.phase(attempt ? 'Repair' : 'Plan', { attempt, errors });
        try { plan = this.validatePlan(await this.planner({ text, scene: this.tools.store.snapshot(), attempt, errors })); }
        catch (error) {
          errors = [{ code: error.message }];
          if (attempt++ >= this.maxRepairs) return { ok: false, code: error.message, attempts: attempt };
          continue;
        }
        this.phase('Validate', { commands: plan.commands.length });
        const results = [];
        for (const command of plan.commands) results.push(this.tools.execute(command));
        errors = results.filter((result) => !result.ok);
        this.phase('Execute', { results });
        if (!errors.length) {
          this.phase('Inspect', { objects: this.tools.store.scene.objects.length });
          this.tools.execute({ tool: 'play_avatar_action', action: plan.avatarAction });
          if (plan.say) this.tools.execute({ tool: 'speak', text: plan.say, emotion: plan.emotion });
          this.phase('Speak', { text: plan.say });
          return { ok: true, plan, results, attempts: attempt + 1 };
        }
        if (attempt++ >= this.maxRepairs) return { ok: false, code: 'REPAIR_LIMIT', errors, results, attempts: attempt };
      }
      return { ok: false, code: 'REPAIR_LIMIT', errors };
    }
  }
  return { AgentLoop };
});
