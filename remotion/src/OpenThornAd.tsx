import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";

const { fontFamily: fraunces } = loadFraunces("normal", {
  weights: ["300"],
  subsets: ["latin"],
});
const { fontFamily: roboto } = loadRoboto("normal", {
  weights: ["400"],
  subsets: ["latin"],
});
// roboto is used in FinalScene (Task 6) — referenced here to ensure module-level font load
void roboto;

const palette = {
  bg: "#09070B",
  text: "#F4EFF8",
  muted: "#C9C1D3",
  purple: "#A78BFA",
  teal: "#5EEAD4",
  amber: "#F6C177",
};

// Scene start frames (30fps)
const SCENE = {
  logo: 0,       // 0s
  keys: 60,      // 2s
  provider: 150, // 5s
  tax: 240,      // 8s
  final: 330,    // 11s
} as const;

// Scene end frames (with 8-frame crossfade overlap into next)
const SCENE_END = {
  logo: 68,
  keys: 158,
  provider: 248,
  tax: 338,
  final: 450, // total duration
} as const;

/** Smooth 0→1 with expo-out easing */
function p(frame: number, start: number, dur: number): number {
  return interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.19, 1, 0.22, 1),
  });
}

/** Scene opacity: fades in at start, fades out near end. Pass isLast=true to skip fade-out. */
function sceneOpacity(
  frame: number,
  start: number,
  end: number,
  isLast = false,
): number {
  if (frame < start) return 0;
  if (!isLast && frame >= end) return 0;
  const fadeIn = p(frame, start, 10);
  const fadeOut = isLast ? 1 : 1 - p(frame, end - 10, 10);
  return fadeIn * fadeOut;
}

export const OpenThornAd = ({ includeAudio = true }: { includeAudio?: boolean }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: palette.bg, overflow: "hidden" }}>
      {includeAudio && <AudioLayer />}

      {/* Scene 1 — Logo reveal (0–68f) */}
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.logo, SCENE_END.logo) }}>
        <LogoRevealScene />
      </AbsoluteFill>

      {/* Scene 2 — "Your keys." (60–158f) */}
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.keys, SCENE_END.keys) }}>
        <StatementScene text="Your keys." accent={palette.purple} startFrame={SCENE.keys} />
      </AbsoluteFill>

      {/* Scene 3 — "Any provider." (150–248f) */}
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.provider, SCENE_END.provider) }}>
        <ProviderScene startFrame={SCENE.provider} />
      </AbsoluteFill>

      {/* Scene 4 — "No platform tax." (240–338f) */}
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.tax, SCENE_END.tax) }}>
        <StatementScene text="No platform tax." accent={palette.amber} startFrame={SCENE.tax} />
      </AbsoluteFill>

      {/* Scene 5 — Final (330–450f) */}
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, SCENE.final, SCENE_END.final, true) }}>
        <FinalScene startFrame={SCENE.final} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

function AudioLayer() {
  const { durationInFrames } = useVideoConfig();
  return (
    <>
      {/* Ambient pad — full duration, fades in/out */}
      <Audio
        src={staticFile("audio/openthorn-ad-ambient.wav")}
        volume={(f) =>
          interpolate(
            f,
            [0, 20, durationInFrames - 30, durationInFrames],
            [0, 0.25, 0.25, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      {/* Whoosh SFX fires at each statement scene entry */}
      <Sequence from={SCENE.keys}>
        <Audio src={staticFile("audio/openthorn-ad-whoosh.wav")} volume={0.65} />
      </Sequence>
      <Sequence from={SCENE.provider}>
        <Audio src={staticFile("audio/openthorn-ad-whoosh.wav")} volume={0.65} />
      </Sequence>
      <Sequence from={SCENE.tax}>
        <Audio src={staticFile("audio/openthorn-ad-whoosh.wav")} volume={0.65} />
      </Sequence>
      {/* Chord fires on final scene entry */}
      <Sequence from={SCENE.final}>
        <Audio src={staticFile("audio/openthorn-ad-chord.wav")} volume={0.8} />
      </Sequence>
    </>
  );
}

function LogoRevealScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.9 },
  });

  const glow = interpolate(frame, [0, 40, 68], [0, 0.72, 0.52], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {/* Radial purple glow behind logo */}
      <div
        style={{
          position: "absolute",
          width: 560,
          height: 560,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${palette.purple}55 0%, transparent 70%)`,
          opacity: glow,
          filter: "blur(60px)",
        }}
      />
      {/* Logo mark */}
      <Img
        src={staticFile("logo.png")}
        style={{
          width: 128,
          height: 128,
          objectFit: "contain",
          transform: `scale(${0.6 + scale * 0.4})`,
          position: "relative",
        }}
      />
    </AbsoluteFill>
  );
}

function StatementScene({
  text,
  accent,
  startFrame,
}: {
  text: string;
  accent: string;
  startFrame: number;
}) {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  const textIn = p(local, 0, 18);
  const underlineIn = p(local, 14, 18);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", display: "inline-block" }}>
        {/* Statement text */}
        <div
          style={{
            fontFamily: fraunces,
            fontSize: 180,
            fontWeight: 300,
            color: palette.text,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            opacity: textIn,
            transform: `translateY(${(1 - textIn) * 24}px)`,
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </div>
        {/* Underline draws left-to-right */}
        <div
          style={{
            position: "absolute",
            bottom: -14,
            left: 0,
            height: 3,
            width: `${underlineIn * 100}%`,
            background: accent,
            borderRadius: 99,
            boxShadow: `0 0 20px ${accent}`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

const PROVIDERS = [
  { src: "openai.png", name: "OpenAI" },
  { src: "anthropic.png", name: "Anthropic" },
  { src: "google.png", name: "Google" },
  { src: "mistralai.png", name: "Mistral" },
  { src: "groq.png", name: "Groq" },
  { src: "deepseek.webp", name: "DeepSeek" },
] as const;

function ProviderScene({ startFrame }: { startFrame: number }) {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  const textIn = p(local, 0, 18);
  const underlineIn = p(local, 14, 18);

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 64,
      }}
    >
      {/* Statement text + teal underline */}
      <div style={{ position: "relative", display: "inline-block" }}>
        <div
          style={{
            fontFamily: fraunces,
            fontSize: 180,
            fontWeight: 300,
            color: palette.text,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            opacity: textIn,
            transform: `translateY(${(1 - textIn) * 24}px)`,
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          Any provider.
        </div>
        <div
          style={{
            position: "absolute",
            bottom: -14,
            left: 0,
            height: 3,
            width: `${underlineIn * 100}%`,
            background: palette.teal,
            borderRadius: 99,
            boxShadow: `0 0 20px ${palette.teal}`,
          }}
        />
      </div>

      {/* Provider logos — staggered fade-in, grayscale */}
      <div style={{ display: "flex", gap: 48, alignItems: "center" }}>
        {PROVIDERS.map(({ src, name }, i) => {
          const logoIn = p(local, 28 + i * 7, 16);
          return (
            <div
              key={name}
              style={{
                opacity: logoIn * 0.5,
                transform: `translateY(${(1 - logoIn) * 14}px)`,
              }}
            >
              <Img
                src={staticFile(src)}
                alt={name}
                style={{
                  height: 44,
                  width: "auto",
                  maxWidth: 100,
                  objectFit: "contain",
                  filter: "grayscale(1) brightness(1.4)",
                }}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function FinalScene(_props: { startFrame: number }) {
  return null;
}
