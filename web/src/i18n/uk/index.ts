// Ukrainian dictionary. Each part is checked against its English counterpart, so keys stay in sync.
import type en from '../en';
import changes from './changes';
import core from './core';
import galaxy from './galaxy';
import mock from './mock';
import pages from './pages';
import settings from './settings';

const uk: Record<keyof typeof en, string> = { ...core, ...galaxy, ...pages, ...mock, ...settings, ...changes };
export default uk;
