import { useState, useEffect, useCallback } from 'react';

export type AIStatus = 'checking' | 'ready' | 'loading' | 'unavailable' | 'unsupported';

export interface Message {
    id: string;
    role: 'user' | 'ai' | 'status';
    text: string;
    timestamp: Date;
}

export function usePromptAPI() {
    const [status, setStatus] = useState<AIStatus>('checking');
    const [session, setSession] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);

    useEffect(() => {
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
                    setStatus('ready');
                    const newSession = await (ai.languageModel || ai).create();
                    setSession(newSession);
                } else if (availability === 'after-download' || availability === 'downloading') {
                    setStatus('loading');

                    const newSession = await (ai.languageModel || ai).create({
                        monitor(m: any) {
                            m.addEventListener('downloadprogress', (e: any) => {
                                const progress = Math.round((e.loaded / e.total) * 100);
                                setDownloadProgress(progress);
                                console.log(`Downloaded ${progress}%`);
                            });
                        },
                    });

                    setSession(newSession);
                    setStatus('ready');
                } else {
                    setStatus('unavailable');
                    setError('Model is not available on this device.');
                }
            } catch (err: any) {
                console.error('Prompt API error:', err);
                setStatus('unavailable');
                setError(err.message || 'Failed to initialize AI.');
            }
        }

        checkAvailability();
    }, []);

    const sendMessage = useCallback(async (text: string, onUpdate: (chunk: string) => void) => {
        if (!session) {
            console.error('sendMessage: AI Session not initialized');
            throw new Error('AI Session not initialized');
        }

        console.log('sendMessage: sending prompt...', text);
        try {
            const stream = session.promptStreaming(text);
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
