// Merge Tripo exports into one game-ready GLB: the mesh and skeleton come from the first file,
// the animation clips from all of them (matched to bones by name).
// Usage: node scripts/merge-clips.mjs out.glb base.glb [more.glb ...]
import { NodeIO } from '@gltf-transform/core'
import { dedup, prune, resample } from '@gltf-transform/functions'

const [out, ...inputs] = process.argv.slice(2)
if (out === undefined || inputs.length === 0) {
  console.error('usage: merge-clips.mjs out.glb base.glb [more.glb ...]')
  process.exit(1)
}

const io = new NodeIO()
const base = await io.read(inputs[0])
const root = base.getRoot()
const buffer = root.listBuffers()[0]
const byName = new Map(root.listNodes().map((n) => [n.getName(), n]))
const have = new Set(root.listAnimations().map((a) => a.getName()))

for (const file of inputs.slice(1)) {
  const src = await io.read(file)
  for (const anim of src.getRoot().listAnimations()) {
    if (have.has(anim.getName())) continue
    const copy = base.createAnimation(anim.getName())
    for (const ch of anim.listChannels()) {
      const target = byName.get(ch.getTargetNode()?.getName() ?? '')
      const s = ch.getSampler()
      if (target === undefined || s === null) continue
      const input = base.createAccessor().setType('SCALAR').setArray(s.getInput().getArray().slice()).setBuffer(buffer)
      const o = s.getOutput()
      const output = base.createAccessor().setType(o.getType()).setArray(o.getArray().slice()).setBuffer(buffer)
      const sampler = base.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(s.getInterpolation())
      copy.addSampler(sampler).addChannel(base.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(sampler))
    }
    have.add(anim.getName())
    console.log(`+ ${anim.getName()} from ${file} (${copy.listChannels().length} channels)`)
  }
}

// Drop keyframes that a straight line between their neighbours already gives, and unused data.
await base.transform(resample({ tolerance: 1e-4 }), dedup(), prune())
await io.write(out, base)
console.log(`wrote ${out}: ${[...have].join(', ')}`)
