// Global type definitions for custom window properties
interface Window {
  layoutRenderStart: number;
  initialContentData: {
    [key: string]: any[];
  };
}