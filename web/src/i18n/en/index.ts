// English dictionary (default language), merged from per-area files.
import core from './core';
import galaxy from './galaxy';
import mock from './mock';
import pages from './pages';

const en = { ...core, ...galaxy, ...pages, ...mock };
export default en;
