import base from './playwright.config';
import {defineConfig} from '@playwright/test';
export default defineConfig({...base,use:{...base.use,browserName:'webkit',launchOptions:{}},outputDir:'test-results-webkit'});
