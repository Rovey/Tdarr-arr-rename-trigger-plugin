// List any npm dependencies which the plugin needs, they will be auto installed when the plugin runs:
module.exports.dependencies = [
    'sync-request',
];

const details = () => ({
    id: 'Tdarr_Plugin_rovey_arr_rename_trigger',
    Stage: 'Post-processing',
    Name: 'Trigger Radarr/Sonarr Rename',
    Type: 'Video',
    Operation: 'Transcode',
    Description: `
    Triggers Radarr or Sonarr to Refresh and Rename the file after transcoding.
    Automatically detects whether to use Radarr or Sonarr based on file metadata.
    `,
    Version: '1.2.0',
    Tags: 'post-processing,3rd party,radarr,sonarr',
    Inputs: [
        {
            name: 'radarr_enabled',
            type: 'boolean',
            defaultValue: true,
            inputUI: {
                type: 'dropdown',
                options: [
                    'true',
                    'false',
                ],
            },
            tooltip: 'Enable Radarr processing',
        },
        {
            name: 'radarr_path_contains',
            type: 'string',
            defaultValue: '/movies/',
            inputUI: {
                type: 'text',
            },
            tooltip: 'Path must contain this string to trigger Radarr (e.g., /movies/ or /media/movies/)',
        },
        {
            name: 'radarr_host',
            type: 'string',
            defaultValue: 'http://localhost:7878',
            inputUI: {
                type: 'text',
            },
            tooltip: 'Full URL to your Radarr instance (e.g., http://localhost:7878)',
        },
        {
            name: 'radarr_api_key',
            type: 'string',
            defaultValue: '',
            inputUI: {
                type: 'text',
            },
            tooltip: 'API Key for Radarr',
        },
        {
            name: 'sonarr_enabled',
            type: 'boolean',
            defaultValue: true,
            inputUI: {
                type: 'dropdown',
                options: [
                    'true',
                    'false',
                ],
            },
            tooltip: 'Enable Sonarr processing',
        },
        {
            name: 'sonarr_path_contains',
            type: 'string',
            defaultValue: '/tv/',
            inputUI: {
                type: 'text',
            },
            tooltip: 'Path must contain this string to trigger Sonarr (e.g., /series/ or /media/tv/)',
        },
        {
            name: 'sonarr_host',
            type: 'string',
            defaultValue: 'http://localhost:8989',
            inputUI: {
                type: 'text',
            },
            tooltip: 'Full URL to your Sonarr instance (e.g., http://localhost:8989)',
        },
        {
            name: 'sonarr_api_key',
            type: 'string',
            defaultValue: '',
            inputUI: {
                type: 'text',
            },
            tooltip: 'API Key for Sonarr',
        },
        {
            name: 'refresh_first',
            type: 'boolean',
            defaultValue: true,
            inputUI: {
                type: 'dropdown',
                options: [
                    'true',
                    'false',
                ],
            },
            tooltip: 'Trigger a refresh before renaming to ensure the new file is detected',
        },
    ],
});

// eslint-disable-next-line no-unused-vars
const plugin = (file, librarySettings, inputs, otherArguments) => {
    const lib = require('../methods/lib')();
    // eslint-disable-next-line no-unused-vars,no-param-reassign
    inputs = lib.loadDefaultValues(inputs, details);

    const response = {
        processFile: false,
        preset: '',
        container: '.mkv',
        handBrakeMode: false,
        FFmpegMode: false,
        reQueueAfter: false,
        infoLog: '',
    };

    const request = require('sync-request');

    const radarrEnabled = inputs.radarr_enabled === true;
    const radarrPathContains = (inputs.radarr_path_contains || '').trim();
    const radarrHost = (inputs.radarr_host || '').replace(/\/+$/, '');
    const radarrApiKey = (inputs.radarr_api_key || '').trim();

    const sonarrEnabled = inputs.sonarr_enabled === true;
    const sonarrPathContains = (inputs.sonarr_path_contains || '').trim();
    const sonarrHost = (inputs.sonarr_host || '').replace(/\/+$/, '');
    const sonarrApiKey = (inputs.sonarr_api_key || '').trim();

    const refreshFirst = inputs.refresh_first === true;

    // Poll a queued *arr command until it finishes (or timeout). Without this,
    // RenameMovie/RenameSeries races the Refresh's mediainfo rescan and skips the rename.
    const sleepSync = (ms) => {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    };
    const waitForCommand = (host, apiKey, commandId, label) => {
        const deadline = Date.now() + 60000;
        while (Date.now() < deadline) {
            try {
                const res = request('GET', `${host}/api/v3/command/${commandId}`, {
                    headers: { 'X-Api-Key': apiKey },
                    timeout: 10000,
                });
                const cmd = JSON.parse(res.getBody('utf8'));
                const status = (cmd.status || '').toLowerCase();
                if (status === 'completed' || status === 'failed' || status === 'aborted') {
                    response.infoLog += `[RenameTrigger] ${label} finished with status: ${status}\n`;
                    return status === 'completed';
                }
            } catch (e) {
                response.infoLog += `[RenameTrigger] ${label} poll error: ${e.message}\n`;
                return false;
            }
            sleepSync(1000);
        }
        response.infoLog += `[RenameTrigger] ${label} timed out after 60s\n`;
        return false;
    };

    const path = file.file || file._id || '';
    if (!path) {
        response.infoLog += '[RenameTrigger] File path missing from Tdarr context.\n';
        return response;
    }

    response.infoLog += `[RenameTrigger] Path: ${path}\n`;

    // Determine which service to use based on path matching
    let useRadarr = false;
    let useSonarr = false;

    if (radarrEnabled && radarrPathContains && path.toLowerCase().includes(radarrPathContains.toLowerCase())) {
        useRadarr = true;
        response.infoLog += `[RenameTrigger] Path contains '${radarrPathContains}' → Using Radarr\n`;
    }

    if (sonarrEnabled && sonarrPathContains && path.toLowerCase().includes(sonarrPathContains.toLowerCase())) {
        useSonarr = true;
        response.infoLog += `[RenameTrigger] Path contains '${sonarrPathContains}' → Using Sonarr\n`;
    }

    if (!useRadarr && !useSonarr) {
        response.infoLog += '[RenameTrigger] Path does not match any enabled service. Skipping.\n';
        response.infoLog += `[RenameTrigger] Radarr enabled: ${radarrEnabled}, path check: '${radarrPathContains}'\n`;
        response.infoLog += `[RenameTrigger] Sonarr enabled: ${sonarrEnabled}, path check: '${sonarrPathContains}'\n`;
        return response;
    }

    const imdb = (path.match(/tt\d+/i) || [])[0];
    const tmdb = (path.match(/(?:tmdb|tmdbid)[-_]?(\d{3,})/i) || [])[1];
    const tvdb = (path.match(/(?:tvdb|tvdbid)[-_]?(\d{3,})/i) || [])[1];

    response.infoLog += `[RenameTrigger] Detected IDs → imdb:${imdb || '-'} tmdb:${tmdb || '-'} tvdb:${tvdb || '-'}\n`;

    try {
        // Process Radarr if enabled and path matches
        if (useRadarr) {
            if (!radarrHost || !radarrApiKey) {
                response.infoLog += '[RenameTrigger] Radarr: Missing host or API key.\n';
            } else {
                response.infoLog += `[RenameTrigger] Processing with Radarr at ${radarrHost}\n`;

                // First, try to find the movie by file path
                response.infoLog += `[RenameTrigger] Looking up movie by file path...\n`;

                const allMoviesRes = request('GET', `${radarrHost}/api/v3/movie`, {
                    headers: { 'X-Api-Key': radarrApiKey },
                    timeout: 15000,
                });

                const allMovies = JSON.parse(allMoviesRes.getBody('utf8'));
                let movie = null;

                // Find movie where the file path matches
                for (const m of allMovies) {
                    if (m.movieFile && m.movieFile.path === path) {
                        movie = m;
                        response.infoLog += `[RenameTrigger] Found movie by file path: ${movie.title} (id=${movie.id})\n`;
                        break;
                    }
                }

                // Fallback: filter the already-fetched movie list client-side. Radarr's
                // GET /api/v3/movie ignores ?imdbId= and silently returns all movies, so
                // taking [0] grabs the wrong title alphabetically.
                if (!movie && (imdb || tmdb)) {
                    response.infoLog += `[RenameTrigger] File not found by path, trying ID match against movie list...\n`;
                    if (imdb) {
                        movie = allMovies.find((m) => m.imdbId === imdb) || null;
                    }
                    if (!movie && tmdb) {
                        const tmdbNum = parseInt(tmdb, 10);
                        movie = allMovies.find((m) => m.tmdbId === tmdbNum) || null;
                    }
                    if (movie) {
                        response.infoLog += `[RenameTrigger] Found movie by ID: ${movie.title} (id=${movie.id})\n`;
                    }
                } else if (!movie) {
                    response.infoLog += '[RenameTrigger] No imdb/tmdb ID found and file not in Radarr.\n';
                }

                if (!movie || !movie.id) {
                    response.infoLog += '[RenameTrigger] Radarr: movie not found in Radarr.\n';
                } else {
                    const movieId = movie.id;
                    response.infoLog += `[RenameTrigger] Using movie: ${movie.title} (id=${movieId})\n`;

                    if (refreshFirst) {
                        response.infoLog += '[RenameTrigger] Triggering RefreshMovie...\n';
                        const refreshRes = request('POST', `${radarrHost}/api/v3/command`, {
                            headers: {
                                'X-Api-Key': radarrApiKey,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                name: 'RefreshMovie',
                                movieIds: [movieId],
                            }),
                            timeout: 10000,
                        });
                        response.infoLog += `[RenameTrigger] RefreshMovie response: ${refreshRes.statusCode}\n`;
                        try {
                            const refreshCmd = JSON.parse(refreshRes.getBody('utf8'));
                            if (refreshCmd && refreshCmd.id) {
                                response.infoLog += `[RenameTrigger] Waiting for RefreshMovie (id=${refreshCmd.id}) to finish before renaming...\n`;
                                waitForCommand(radarrHost, radarrApiKey, refreshCmd.id, 'RefreshMovie');
                            }
                        } catch (e) {
                            response.infoLog += `[RenameTrigger] Could not parse RefreshMovie response: ${e.message}\n`;
                        }
                    }

                    // Probe pending renames first — only fire RenameMovie if Radarr
                    // actually has work to do. Must run AFTER Refresh so mediainfo is current.
                    let pendingCount = -1;
                    try {
                        const probeRes = request('GET', `${radarrHost}/api/v3/rename?movieId=${movieId}`, {
                            headers: { 'X-Api-Key': radarrApiKey },
                            timeout: 10000,
                        });
                        const pending = JSON.parse(probeRes.getBody('utf8'));
                        pendingCount = Array.isArray(pending) ? pending.length : 0;
                        response.infoLog += `[RenameTrigger] Pending renames after refresh: ${pendingCount}\n`;
                    } catch (e) {
                        response.infoLog += `[RenameTrigger] Rename probe failed (${e.message}), will trigger anyway.\n`;
                    }

                    if (pendingCount === 0) {
                        response.infoLog += '[RenameTrigger] ✓ No rename needed — skipping RenameMovie.\n';
                    } else {
                        response.infoLog += '[RenameTrigger] Triggering RenameMovie...\n';
                        const renameRes = request('POST', `${radarrHost}/api/v3/command`, {
                            headers: {
                                'X-Api-Key': radarrApiKey,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                name: 'RenameMovie',
                                movieIds: [movieId],
                            }),
                            timeout: 10000,
                        });
                        response.infoLog += `[RenameTrigger] RenameMovie response: ${renameRes.statusCode}\n`;
                        try {
                            const renameCmd = JSON.parse(renameRes.getBody('utf8'));
                            if (renameCmd && renameCmd.id) {
                                waitForCommand(radarrHost, radarrApiKey, renameCmd.id, 'RenameMovie');
                            }
                        } catch (e) {
                            response.infoLog += `[RenameTrigger] Could not parse RenameMovie response: ${e.message}\n`;
                        }
                        response.infoLog += '[RenameTrigger] ✓ Radarr rename command sent successfully!\n';
                    }
                }
            }
        }

        // Process Sonarr if enabled and path matches
        if (useSonarr) {
            if (!sonarrHost || !sonarrApiKey) {
                response.infoLog += '[RenameTrigger] Sonarr: Missing host or API key.\n';
            } else {
                response.infoLog += `[RenameTrigger] Processing with Sonarr at ${sonarrHost}\n`;

                // First, try to find the series by episode file path
                response.infoLog += `[RenameTrigger] Looking up series by episode file path...\n`;

                const allSeriesRes = request('GET', `${sonarrHost}/api/v3/series`, {
                    headers: { 'X-Api-Key': sonarrApiKey },
                    timeout: 15000,
                });

                const allSeries = JSON.parse(allSeriesRes.getBody('utf8'));
                let show = null;

                // Check each series for matching episode file
                for (const s of allSeries) {
                    if (s.id) {
                        try {
                            // Get episode files for this series
                            const episodeFilesRes = request('GET', `${sonarrHost}/api/v3/episodefile?seriesId=${s.id}`, {
                                headers: { 'X-Api-Key': sonarrApiKey },
                                timeout: 10000,
                            });
                            const episodeFiles = JSON.parse(episodeFilesRes.getBody('utf8'));
                            
                            // Check if any episode file path matches
                            for (const ef of episodeFiles) {
                                if (ef.path === path) {
                                    show = s;
                                    response.infoLog += `[RenameTrigger] Found series by episode file path: ${show.title} (id=${show.id})\n`;
                                    break;
                                }
                            }
                            if (show) break;
                        } catch (e) {
                            // Skip series if episode file lookup fails
                        }
                    }
                }

                // Fallback: filter the already-fetched series list client-side. Sonarr's
                // GET /api/v3/series only honors tvdbId reliably; imdbId/tmdbId can return
                // an unfiltered list, making [0] the wrong show.
                if (!show && (tvdb || imdb || tmdb)) {
                    response.infoLog += `[RenameTrigger] File not found by path, trying ID match against series list...\n`;
                    if (tvdb) {
                        const tvdbNum = parseInt(tvdb, 10);
                        show = allSeries.find((s) => s.tvdbId === tvdbNum) || null;
                    }
                    if (!show && imdb) {
                        show = allSeries.find((s) => s.imdbId === imdb) || null;
                    }
                    if (!show && tmdb) {
                        const tmdbNum = parseInt(tmdb, 10);
                        show = allSeries.find((s) => s.tmdbId === tmdbNum) || null;
                    }
                    if (show) {
                        response.infoLog += `[RenameTrigger] Found series by ID: ${show.title} (id=${show.id})\n`;
                    }
                } else if (!show) {
                    response.infoLog += '[RenameTrigger] No tvdb/tmdb/imdb ID found and file not in Sonarr.\n';
                }

                if (!show || !show.id) {
                    response.infoLog += '[RenameTrigger] Sonarr: series not found in Sonarr.\n';
                } else {
                    const seriesId = show.id;
                    response.infoLog += `[RenameTrigger] Using series: ${show.title} (id=${seriesId})\n`;

                    if (refreshFirst) {
                        response.infoLog += '[RenameTrigger] Triggering RefreshSeries...\n';
                        const refreshRes = request('POST', `${sonarrHost}/api/v3/command`, {
                            headers: {
                                'X-Api-Key': sonarrApiKey,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                name: 'RefreshSeries',
                                seriesIds: [seriesId],
                            }),
                            timeout: 10000,
                        });
                        response.infoLog += `[RenameTrigger] RefreshSeries response: ${refreshRes.statusCode}\n`;
                        try {
                            const refreshCmd = JSON.parse(refreshRes.getBody('utf8'));
                            if (refreshCmd && refreshCmd.id) {
                                response.infoLog += `[RenameTrigger] Waiting for RefreshSeries (id=${refreshCmd.id}) to finish before renaming...\n`;
                                waitForCommand(sonarrHost, sonarrApiKey, refreshCmd.id, 'RefreshSeries');
                            }
                        } catch (e) {
                            response.infoLog += `[RenameTrigger] Could not parse RefreshSeries response: ${e.message}\n`;
                        }
                    }

                    // Probe pending renames first — only fire RenameSeries if Sonarr
                    // actually has work to do. Must run AFTER Refresh so mediainfo is current.
                    let pendingCount = -1;
                    try {
                        const probeRes = request('GET', `${sonarrHost}/api/v3/rename?seriesId=${seriesId}`, {
                            headers: { 'X-Api-Key': sonarrApiKey },
                            timeout: 10000,
                        });
                        const pending = JSON.parse(probeRes.getBody('utf8'));
                        pendingCount = Array.isArray(pending) ? pending.length : 0;
                        response.infoLog += `[RenameTrigger] Pending renames after refresh: ${pendingCount}\n`;
                    } catch (e) {
                        response.infoLog += `[RenameTrigger] Rename probe failed (${e.message}), will trigger anyway.\n`;
                    }

                    if (pendingCount === 0) {
                        response.infoLog += '[RenameTrigger] ✓ No rename needed — skipping RenameSeries.\n';
                    } else {
                        response.infoLog += '[RenameTrigger] Triggering RenameSeries...\n';
                        const renameRes = request('POST', `${sonarrHost}/api/v3/command`, {
                            headers: {
                                'X-Api-Key': sonarrApiKey,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                name: 'RenameSeries',
                                seriesIds: [seriesId],
                            }),
                            timeout: 10000,
                        });
                        response.infoLog += `[RenameTrigger] RenameSeries response: ${renameRes.statusCode}\n`;
                        try {
                            const renameCmd = JSON.parse(renameRes.getBody('utf8'));
                            if (renameCmd && renameCmd.id) {
                                waitForCommand(sonarrHost, sonarrApiKey, renameCmd.id, 'RenameSeries');
                            }
                        } catch (e) {
                            response.infoLog += `[RenameTrigger] Could not parse RenameSeries response: ${e.message}\n`;
                        }
                        response.infoLog += '[RenameTrigger] ✓ Sonarr rename command sent successfully!\n';
                    }
                }
            }
        }
    } catch (err) {
        response.infoLog += `[RenameTrigger] ✗ Error: ${err.message}\n`;
    }

    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
