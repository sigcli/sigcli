'use client';

import { useEffect, useRef, useState } from 'react';

interface Step {
    command: string;
    output: string[];
}

const STEPS: Step[] = [
    {
        command: 'sig init',
        output: [
            '✓ Browser detected: Chrome',
            '✓ Config created at ~/.sig/config.yaml',
        ],
    },
    {
        command: 'sig login jira.example.com',
        output: [
            '✓ Browser opened — complete login...',
            '✓ Credentials saved for "jira"',
        ],
    },
    {
        command: 'sig run jira -- curl https://jira.example.com/rest/api/2/myself',
        output: ['{"displayName": "Alice", "emailAddress": "alice@example.com"}'],
    },
];

const TYPING_SPEED = 30;
const OUTPUT_DELAY = 400;
const STEP_PAUSE = 600;
const LOOP_PAUSE = 2500;

export function TerminalAnimation() {
    const [stepIndex, setStepIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);
    const [showOutput, setShowOutput] = useState(false);
    const [done, setDone] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (done) {
            timerRef.current = setTimeout(() => {
                setStepIndex(0);
                setCharIndex(0);
                setShowOutput(false);
                setDone(false);
            }, LOOP_PAUSE);
            return () => {
                if (timerRef.current) clearTimeout(timerRef.current);
            };
        }

        const step = STEPS[stepIndex];
        if (!step) return;

        if (!showOutput && charIndex < step.command.length) {
            timerRef.current = setTimeout(() => {
                setCharIndex((c) => c + 1);
            }, TYPING_SPEED);
        } else if (!showOutput && charIndex >= step.command.length) {
            timerRef.current = setTimeout(() => {
                setShowOutput(true);
            }, OUTPUT_DELAY);
        } else if (showOutput) {
            timerRef.current = setTimeout(() => {
                if (stepIndex < STEPS.length - 1) {
                    setStepIndex((s) => s + 1);
                    setCharIndex(0);
                    setShowOutput(false);
                } else {
                    setDone(true);
                }
            }, STEP_PAUSE);
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [stepIndex, charIndex, showOutput, done]);

    const completedSteps = STEPS.slice(0, stepIndex);
    const currentStep = STEPS[stepIndex];

    return (
        <div
            className="w-full rounded-lg overflow-hidden"
            style={{ background: '#18181b', border: '1px solid #27272a' }}
        >
            <style>{`
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                .terminal-cursor {
                    animation: blink 1s step-end infinite;
                }
            `}</style>

            {/* Title bar with traffic lights */}
            <div
                className="flex items-center gap-2 px-4 py-3"
                style={{ borderBottom: '1px solid #27272a' }}
            >
                <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: '#ff5f57' }}
                />
                <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: '#febc2e' }}
                />
                <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: '#28c840' }}
                />
            </div>

            {/* Terminal content */}
            <div
                className="p-4 font-mono text-sm leading-relaxed"
                style={{ color: '#e4e4e7', minHeight: '200px' }}
            >
                {/* Completed steps */}
                {completedSteps.map((step, i) => (
                    <div key={i} className="mb-3">
                        <div>
                            <span style={{ color: '#a1a1aa' }}>$ </span>
                            {step.command}
                        </div>
                        {step.output.map((line, j) => (
                            <div key={j} style={{ color: '#a1a1aa' }}>
                                {line}
                            </div>
                        ))}
                    </div>
                ))}

                {/* Current step */}
                {currentStep && !done && (
                    <div>
                        <div>
                            <span style={{ color: '#a1a1aa' }}>$ </span>
                            {currentStep.command.slice(0, charIndex)}
                            {!showOutput && (
                                <span
                                    className="terminal-cursor"
                                    style={{
                                        display: 'inline-block',
                                        width: '8px',
                                        height: '16px',
                                        background: '#e4e4e7',
                                        verticalAlign: 'text-bottom',
                                        marginLeft: '1px',
                                    }}
                                />
                            )}
                        </div>
                        {showOutput &&
                            currentStep.output.map((line, j) => (
                                <div key={j} style={{ color: '#a1a1aa' }}>
                                    {line}
                                </div>
                            ))}
                    </div>
                )}

                {/* Done state: show all steps */}
                {done && (
                    <div>
                        {STEPS[STEPS.length - 1].output.map((line, j) => (
                            <div key={j} style={{ color: '#a1a1aa' }}>
                                {line}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
