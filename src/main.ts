/**
 * Bootstrap final — instantiate App, wire global debug handle.
 */

import { App } from "@app/App";

const app = new App();
app.init();

// Debug handle untuk dev console
(window as unknown as { __pdfViewer: App }).__pdfViewer = app;
