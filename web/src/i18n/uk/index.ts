// Ukrainian dictionary. Each part is checked against its English counterpart, so keys stay in sync.
import type en from '../en';
import core from './core';
import galaxy from './galaxy';
import mock from './mock';
import pages from './pages';

const uk: Record<keyof typeof en, string> = { ...core, ...galaxy, ...pages, ...mock };
export default uk;
