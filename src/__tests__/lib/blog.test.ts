import { getBlogPost, getBlogPostSlugs } from '@/lib/blog';
import fs from 'fs';
import path from 'path';

// Mock fs module
jest.mock('fs');
jest.mock('path');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('Blog utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPath.join.mockReturnValue('/mocked/path');
  });

  describe('getBlogPostSlugs', () => {
    test('returns slugs from markdown files', () => {
      mockFs.readdirSync.mockReturnValue(['post1.md', 'post2.md', 'not-markdown.txt'] as unknown as fs.Dirent[]);

      const slugs = getBlogPostSlugs();

      expect(slugs).toEqual(['post1', 'post2']);
      expect(slugs).not.toContain('not-markdown');
    });

    test('returns empty array when directory read fails', () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('Directory not found');
      });

      const slugs = getBlogPostSlugs();

      expect(slugs).toEqual([]);
    });
  });

  describe('getBlogPost', () => {
    test('returns null when file read fails', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const post = getBlogPost('nonexistent-post');

      expect(post).toBeNull();
    });

    test('returns post with default values for missing frontmatter', () => {
      const mockFileContent = `---
title: Test Post
---
# Content here`;

      mockFs.readFileSync.mockReturnValue(mockFileContent);

      const post = getBlogPost('test-post');

      expect(post).toMatchObject({
        slug: 'test-post',
        title: 'Test Post',
        description: '',
        tags: [],
      });
    });
  });
});