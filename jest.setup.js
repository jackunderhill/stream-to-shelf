import '@testing-library/jest-dom'
import 'whatwg-fetch'

// Mock Next.js edge runtime globals for API route tests
global.Request = global.Request || class Request {}
global.Response = global.Response || class Response {}
global.Headers = global.Headers || class Headers {}