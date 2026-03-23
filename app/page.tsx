'use client';

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { SandpackProvider, SandpackLayout, SandpackCodeEditor, SandpackPreview, SandpackFileExplorer } from '@codesandbox/sandpack-react';
import { Send, Loader2, Code2, Globe, Database, Terminal, Settings2, Upload } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

const initialFiles = {
  '/App.tsx': `import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-8 font-sans">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 border border-zinc-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">OmniSandbox App</h1>
        </div>
        
        <p className="text-lg text-zinc-600 mb-8 leading-relaxed">
          Your production-grade application will be generated here. Submit an idea in the chat to get started.
        </p>
        
        <div className="bg-zinc-50 rounded-xl p-6 border border-zinc-200">
          <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-4">Capabilities</h3>
          <ul className="space-y-3">
            {['Live Code Generation & Editing', 'Real-time React Preview', 'Deep Web & Blockchain Search via Google Grounding', 'Production-Grade Architecture'].map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-zinc-700">
                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}`,
  '/styles.css': `body { margin: 0; padding: 0; }`,
  '/public/index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OmniSandbox App</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
};

type Message = {
  role: 'user' | 'ai';
  content: string;
};

export default function OmniSandbox() {
  const [isMounted, setIsMounted] = useState(false);
  const [files, setFiles] = useState<Record<string, string>>(initialFiles);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const submitPrompt = async (userMessage: string, currentFiles: Record<string, string>) => {
    if (!userMessage.trim() || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const prompt = `
You are an elite, production-grade AI software engineer. Your goal is to build complete, production-ready applications based on user requests.
You have access to Google Search to look up the latest documentation, references, software architectures, blockchain data, and deep web archives.
You must generate the full code for the requested application. The application will be rendered in a React (TypeScript) sandbox.

Current sandbox files:
${JSON.stringify(currentFiles, null, 2)}

User Request: ${userMessage}

Instructions:
1. Use Google Search to find the most up-to-date libraries, references, and best practices if needed.
2. Generate the complete, production-ready source code for the requested features.
3. Provide the necessary files (e.g., /App.tsx, /styles.css, /components/...).
4. Always use the most up-to-date coding practices.
5. If the user asks for blockchain or deep web features, use Google Search to find relevant APIs, smart contract examples, or architectural patterns, and implement them robustly.
6. If the user uploads an existing project, analyze the code, fix any errors, and suggest improvements and new features.
7. Return a JSON object containing a detailed 'message' explaining your changes and references, and a 'files' array with the updated/new files.
8. Tailwind CSS is available via CDN in public/index.html, so you can use Tailwind classes directly in your components.
9. If you need additional npm packages, you can provide a /package.json file with the required dependencies.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              message: {
                type: Type.STRING,
                description: 'A detailed, professional response explaining the changes, the architecture, and any references found.',
              },
              files: {
                type: Type.ARRAY,
                description: 'The complete set of files for the application. You must provide the FULL content for every file you create or modify. Do not use placeholders.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    path: {
                      type: Type.STRING,
                      description: 'The absolute path of the file, e.g., /App.tsx, /styles.css, /components/Button.tsx',
                    },
                    content: {
                      type: Type.STRING,
                      description: 'The complete, production-ready source code for the file.',
                    },
                  },
                  required: ['path', 'content'],
                },
              },
            },
            required: ['message', 'files'],
          },
        },
      });

      const jsonStr = response.text?.trim() || '{}';
      const result = JSON.parse(jsonStr);

      if (result.message) {
        setMessages((prev) => [...prev, { role: 'ai', content: result.message }]);
      }

      if (result.files && Array.isArray(result.files)) {
        const newFiles = { ...currentFiles };
        result.files.forEach((file: any) => {
          if (file.path && file.content) {
            newFiles[file.path] = file.content;
          }
        });
        setFiles(newFiles);
      }
    } catch (error) {
      console.error('Error generating code:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: 'An error occurred while generating the code. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userMessage = input.trim();
    setInput('');
    await submitPrompt(userMessage, files);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const newFiles: Record<string, string> = { ...files };
    let fileCount = 0;

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      // Skip common non-source directories
      if (file.webkitRelativePath.includes('node_modules') || file.webkitRelativePath.includes('.git')) {
        continue;
      }
      
      try {
        const text = await file.text();
        const path = file.webkitRelativePath ? `/${file.webkitRelativePath}` : `/${file.name}`;
        newFiles[path] = text;
        fileCount++;
      } catch (err) {
        console.error(`Failed to read file ${file.name}`, err);
      }
    }

    if (fileCount > 0) {
      setFiles(newFiles);
      const analysisPrompt = `I have uploaded ${fileCount} new files to the project. Please scan the entire codebase, fix any known errors or bugs, and suggest new features or ways to make the project more productive. Return the fixed files and a detailed message with your suggestions.`;
      await submitPrompt(analysisPrompt, newFiles);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isMounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-zinc-950 text-zinc-50 font-sans">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-emerald-400" />
          <h1 className="text-lg font-semibold tracking-tight">OmniSandbox AI</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <div className="flex items-center gap-1.5">
            <Globe className="h-4 w-4" />
            <span>Live Web Access</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Database className="h-4 w-4" />
            <span>Blockchain Ready</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Code2 className="h-4 w-4" />
            <span>Production Grade</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Chat Panel */}
        <div className="flex w-[400px] flex-col border-r border-zinc-800 bg-zinc-900/50">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500 space-y-4">
                <Settings2 className="h-12 w-12 text-zinc-700" />
                <div>
                  <p className="font-medium text-zinc-300">Welcome to OmniSandbox</p>
                  <p className="text-sm mt-1 max-w-xs">Describe your project idea, and I will generate a complete, production-ready application.</p>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-sm'
                        : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex items-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-zinc-800 px-4 py-3 text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Synthesizing code & searching web...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-zinc-800 p-4 bg-zinc-900">
            <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                multiple 
                // @ts-ignore
                webkitdirectory="true"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50"
                title="Upload Project Folder"
              >
                <Upload className="h-5 w-5" />
              </button>
              <div className="relative flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="Describe your project..."
                  className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-4 pr-12 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  rows={3}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-3 bottom-3 rounded-lg bg-emerald-600 p-2 text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
            <p className="mt-2 text-center text-xs text-zinc-500">
              Press Enter to send, Shift+Enter for new line. Upload a folder to analyze.
            </p>
          </div>
        </div>

        {/* Sandbox Panel */}
        <div className="flex flex-1 flex-col bg-zinc-950 overflow-hidden">
          <SandpackProvider
            template="react-ts"
            theme="dark"
            files={files}
            customSetup={{
              dependencies: {
                "lucide-react": "latest",
                "framer-motion": "latest",
                "clsx": "latest",
                "tailwind-merge": "latest"
              }
            }}
            options={{
              classes: {
                "sp-layout": "h-full rounded-none border-none",
                "sp-wrapper": "h-full",
              }
            }}
          >
            <SandpackLayout className="h-full flex-1 border-none rounded-none !h-full">
              <SandpackFileExplorer className="w-48 border-r border-zinc-800 bg-zinc-900" />
              <SandpackCodeEditor 
                showTabs 
                showLineNumbers 
                showInlineErrors
                wrapContent
                className="flex-1 border-r border-zinc-800"
              />
              <SandpackPreview 
                showNavigator 
                showRefreshButton 
                showOpenInCodeSandbox={false}
                className="flex-1 bg-white"
              />
            </SandpackLayout>
          </SandpackProvider>
        </div>
      </main>
    </div>
  );
}
