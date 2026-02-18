import { useState, useEffect, useCallback } from 'react';

export type AIStatus = 'checking' | 'ready' | 'loading' | 'unavailable' | 'unsupported';

export interface Message {
    id: string;
    role: 'user' | 'ai' | 'status';
    text: string;
    timestamp: Date;
}

export function usePromptAPI(systemPrompt: string = 'You are a helpful and friendly assistant.') {
    const [status, setStatus] = useState<AIStatus>('checking');
    const [session, setSession] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);

    useEffect(() => {
        let isActive = true;

        async function checkAvailability() {
            try {
                // Determine the correct API entry point
                const ai = (window as any).ai || (window as any).LanguageModel;

                if (!ai) {
                    console.log('AI API not found (window.ai and LanguageModel are missing)');
                    setStatus('unsupported');
                    return;
                }

                // Check availability with standard options
                const availability = await (ai.languageModel || ai).availability({
                    expectedInputs: [{ type: 'text', languages: ['en'] }],
                    expectedOutputs: [{ type: 'text', languages: ['en'] }],
                });

                console.log('AI Availability:', availability);

                if (availability === 'readily' || availability === 'available') {
                    if (!isActive) return;
                    setStatus('ready');
                    const newSession = await (ai.languageModel || ai).create({
                        initialPrompts: [{ role: 'system', content: systemPrompt }]
                    });
                    if (isActive) setSession(newSession);
                    else if (newSession.destroy) newSession.destroy();
                } else if (availability === 'after-download' || availability === 'downloading') {
                    if (!isActive) return;
                    setStatus('loading');

                    const newSession = await (ai.languageModel || ai).create({
                        initialPrompts: [{ role: 'system', content: systemPrompt }],
                        monitor(m: any) {
                            m.addEventListener('downloadprogress', (e: any) => {
                                const progress = Math.round((e.loaded / e.total) * 100);
                                if (isActive) setDownloadProgress(progress);
                                console.log(`Downloaded ${progress}%`);
                            });
                        },
                    });

                    if (isActive) {
                        setSession(newSession);
                        setStatus('ready');
                    } else if (newSession.destroy) {
                        newSession.destroy();
                    }
                } else {
                    if (isActive) {
                        setStatus('unavailable');
                        setError('Model is not available on this device.');
                    }
                }
            } catch (err: any) {
                if (isActive) {
                    console.error('Prompt API error:', err);
                    setStatus('unavailable');
                    setError(err.message || 'Failed to initialize AI.');
                }
            }
        }

        checkAvailability();

        return () => {
            isActive = false;
        };
    }, [systemPrompt]);

    const sendMessage = useCallback(async (text: string, onUpdate: (chunk: string) => void, signal?: AbortSignal) => {
        if (!session) {
            console.error('sendMessage: AI Session not initialized');
            throw new Error('AI Session not initialized');
        }

        console.log('sendMessage: sending prompt...', text);
        try {
            const stream = session.promptStreaming(text, { signal });
            console.log('sendMessage: stream object received:', stream);

            let fullResponse = '';

            // consuming the stream
            for await (const chunk of stream) {
                console.log('sendMessage: received chunk:', chunk);
                fullResponse += chunk; // Append delta to full response
                onUpdate(fullResponse);
            }

            console.log('sendMessage: stream finished. Final response length:', fullResponse.length);
            return fullResponse;
        } catch (err: any) {
            console.error('sendMessage: Streaming error:', err);
            throw err;
        }
    }, [session]);

    return { status, sendMessage, error, downloadProgress };
}
