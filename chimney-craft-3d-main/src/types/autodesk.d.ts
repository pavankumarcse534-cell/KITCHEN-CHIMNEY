// TypeScript definitions for Autodesk Viewer SDK

declare global {
    interface Window {
        Autodesk: typeof Autodesk;
    }
}

declare namespace Autodesk {
    namespace Viewing {
        class GuiViewer3D {
            constructor(container: HTMLElement, config?: any);
            start(
                urn?: string,
                onSuccessCallback?: () => void,
                onErrorCallback?: (errorCode: number, errorMsg: string) => void,
                onSuccessCallback2?: () => void,
                onErrorCallback2?: (errorMsg: string) => void
            ): void;
            finish(): void;
            loadDocumentNode(document: Document, viewable: any): Promise<void>;
            unloadModel(model: any): void;
            model: any;
        }

        class Document {
            static load(
                documentId: string,
                onSuccessCallback: (doc: Document) => void,
                onErrorCallback: (errorCode: number, errorMsg: string) => void
            ): void;
            getRoot(): {
                getDefaultGeometry(): any;
            };
        }

        interface InitializerOptions {
            env: string;
            api: string;
            getAccessToken: (callback: (token: string, expire: number) => void) => void;
            webGLHelpLink?: string;
        }

        function Initializer(
            options: InitializerOptions,
            onSuccessCallback: () => void
        ): void;
    }
}

export { };
