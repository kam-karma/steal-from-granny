/**
 * Poki SDK wrapper (https://sdk.poki.com/html5/). When the SDK is missing (offline dev, ad blocker)
 * every call still works: breaks resolve at once and rewarded breaks grant the reward, so the game never locks up.
 */
interface PokiSDKApi {
  init: () => Promise<void>
  setDebug: (on: boolean) => void
  gameLoadingFinished: () => void
  gameplayStart: () => void
  gameplayStop: () => void
  commercialBreak: (onStart?: () => void) => Promise<void>
  rewardedBreak: (onStart?: () => void) => Promise<boolean>
}

declare global {
  interface Window {
    PokiSDK?: PokiSDKApi
  }
}

export interface Platform {
  readonly ready: Promise<void>
  readonly loadingFinished: () => void
  readonly gameplayStart: () => void
  readonly gameplayStop: () => void
  /** A normal ad break between rounds; Poki decides whether an ad actually plays. */
  readonly commercialBreak: () => Promise<void>
  /** An opt-in ad; resolves true when the player earned the reward. */
  readonly rewardedBreak: () => Promise<boolean>
  readonly hasSdk: () => boolean
}

export function createPlatform(onMute: (muted: boolean) => void): Platform {
  let sdk: PokiSDKApi | null = null
  let playing = false
  let busy = false

  const ready = (async (): Promise<void> => {
    const s = window.PokiSDK
    if (s === undefined) return
    try {
      await s.init()
      if (['localhost', '127.0.0.1'].includes(location.hostname)) s.setDebug(true)
      sdk = s
    } catch (error) {
      // Ad blockers make init reject; the game must keep working without ads.
      console.warn('Poki SDK not available, continuing without ads.', error)
      sdk = s
    }
  })()

  async function around<T>(run: (s: PokiSDKApi) => Promise<T>, fallback: T, whenBusy: T): Promise<T> {
    await ready
    if (busy) return whenBusy
    if (sdk === null) return fallback
    busy = true
    const wasPlaying = playing
    if (wasPlaying) stop()
    try {
      return await run(sdk)
    } catch (error) {
      console.warn('Ad break failed, continuing.', error)
      return fallback
    } finally {
      onMute(false)
      busy = false
    }
  }

  function stop(): void {
    if (!playing) return
    playing = false
    // Queued behind init, so start/stop always reach the SDK in pairs and in order.
    void ready.then(() => sdk?.gameplayStop())
  }

  return {
    ready,
    hasSdk: () => sdk !== null,
    loadingFinished: () => void ready.then(() => sdk?.gameLoadingFinished()),
    gameplayStart: () => {
      if (playing) return
      playing = true
      void ready.then(() => sdk?.gameplayStart())
    },
    gameplayStop: stop,
    commercialBreak: () => around((s) => s.commercialBreak(() => onMute(true)), undefined, undefined),
    rewardedBreak: () => around((s) => s.rewardedBreak(() => onMute(true)), true, false),
  }
}
