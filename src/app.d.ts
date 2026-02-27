// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// File System Access API (Chrome/Edge)
	interface FileSystemFileHandle {
		getFile(): Promise<File>;
		createWritable(): Promise<FileSystemWritableFileStream>;
	}
	interface FileSystemWritableFileStream extends WritableStream {
		write(data: ArrayBuffer | Blob | string): Promise<void>;
		close(): Promise<void>;
	}
	interface Window {
		showOpenFilePicker(options?: {
			types?: { description: string; accept: Record<string, string[]> }[];
			multiple?: boolean;
		}): Promise<FileSystemFileHandle[]>;
	}
}

export {};
