// English dictionary (default language), merged from per-area files.
import changes from './changes';
import core from './core';
import galaxy from './galaxy';
import mock from './mock';
import pages from './pages';
import settings from './settings';

const en = { ...core, ...galaxy, ...pages, ...mock, ...settings, ...changes };
export default en;
