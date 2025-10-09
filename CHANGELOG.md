# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-09

### Added
- Initial release of Tdarr Radarr/Sonarr Rename Trigger Plugin
- Path-based detection for Radarr and Sonarr
- Independent enable/disable toggles for each service
- Configurable path matching strings
- Primary lookup by exact file path matching
- Fallback lookup using IMDB, TMDB, and TVDB IDs
- Support for Radarr v3 API with correct command structure
- Support for Sonarr v3 API with episode file lookup
- IMDB ID support for Sonarr series lookup
- Optional refresh before rename functionality
- Detailed logging for debugging and monitoring
- Synchronous HTTP requests using sync-request library
- Comprehensive error handling

### Technical Details
- Radarr: GET /api/v3/movie and POST /api/v3/command (RefreshMovie, RenameMovie)
- Sonarr: GET /api/v3/series, GET /api/v3/episodefile, POST /api/v3/command (RefreshSeries, RenameSeries)
- Uses movieIds/seriesIds arrays for command parameters (verified against Radarr source code)
- ID extraction from file paths: IMDB (tt\d+), TMDB (tmdbid-\d+), TVDB (tvdbid-\d+)

[1.0.0]: https://github.com/Rovey/Tdarr-arr-rename-trigger-plugin/releases/tag/v1.0.0
