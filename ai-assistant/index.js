// Local AI Assistant MVP (no external API calls yet)
// Exposes an Express Router mounted at /api/ai
const express = require('express')
const fs = require('fs')
const path = require('path')

const router = express.Router()

const STATE_FILE = path.resolve(__dirname, 'ai_state.json')
let state = { conversations: [], currentPlan: null, logs: [] }
try {
  const raw = fs.readFileSync(STATE_FILE, 'utf8')
  state = JSON.parse(raw)
} catch (e) {
  state = { conversations: [], currentPlan: null, logs: [] }
}
function saveState(){ fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)) }

// Simple planner (split task into steps)
function planFromTask(task){
  const t = (task||'').trim()
  const steps = []
  steps.push({ id: 'step1', text: `分析任务: ${t}` })
  steps.push({ id: 'step2', text: '将任务拆解为若干子步骤' })
  return { planId: 'p1', task: t, steps }
}

// Simple executor (dry-run by default)
function executePlan(plan, stepId, dryRun){
  const results = []
  const idx = plan.steps.findIndex(s => s.id === stepId)
  if (idx < 0) return results
  for(let i=idx; i<plan.steps.length; i++){
    const s = plan.steps[i]
    const ok = dryRun ? false : true
    results.push({ step: s.id, text: s.text, executed: !dryRun, ok })
  }
  // log
  state.logs.push({ time: new Date().toISOString(), planId: plan.planId, stepId, dryRun, results })
  saveState()
  return results
}

// Routes
// 1) chat: simple echo + auto plan
router.post('/chat', (req, res)=>{
  const userInput = req.body && req.body.userInput
  const reply = `AI: 收到你的消息：${userInput}`
  state.conversations.push({ from: 'user', text: userInput, ts: Date.now() })
  state.conversations.push({ from: 'ai', text: reply, ts: Date.now() })
  saveState()
  res.json({ code: 200, reply })
})

router.post('/plan', (req, res)=>{
  const task = req.body && req.body.task
  const plan = planFromTask(task)
  state.currentPlan = plan
  saveState()
  res.json({ code: 200, plan })
})

router.post('/execute', (req, res)=>{
  const plan = state.currentPlan
  if(!plan){ return res.status(400).json({ code: 400, msg: '无有效计划' })}
  const { planId, stepId, dryRun, confirm } = req.body
  const runningDry = dryRun !== false
  // By default dry-run; require confirm to execute
  if(!confirm){
    const results = executePlan(plan, stepId || plan.steps[0].id, true)
    return res.json({ code: 200, dryRun: true, results })
  }
  const results = executePlan(plan, stepId || plan.steps[0].id, false)
  res.json({ code: 200, dryRun: false, results })
})

router.get('/logs', (req, res)=>{
  res.json({ code: 200, logs: state.logs })
})

function apiRouter(){
  return router
}

module.exports = apiRouter
