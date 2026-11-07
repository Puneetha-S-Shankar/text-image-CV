# Notebook 03b: backend test

Config: cascade_config_lowmem.json (generator setup M3). Server ready after 37 s (download + warm-up).

## Contract test: all responses match

| prompt                                   | mode     | ok   | problems   |   server_s |   tries | passed   |
|:-----------------------------------------|:---------|:-----|:-----------|-----------:|--------:|:---------|
| two dogs and one cat sitting on a sofa   | fast     | True |            |      1.553 |       1 | True     |
| two dogs and one cat sitting on a sofa   | balanced | True |            |      1.455 |       1 | True     |
| two dogs and one cat sitting on a sofa   | quality  | True |            |      2.18  |       1 | True     |
| a red car to the left of a blue bus      | fast     | True |            |      1.658 |       1 | False    |
| a red car to the left of a blue bus      | balanced | True |            |      4.906 |       3 | False    |
| a red car to the left of a blue bus      | quality  | True |            |      3.856 |       2 | False    |
| a cozy cabin in a snowy forest at night, | fast     | True |            |      1.348 |       1 | True     |
| a cozy cabin in a snowy forest at night, | balanced | True |            |      1.311 |       1 | True     |
| a cozy cabin in a snowy forest at night, | quality  | True |            |      1.97  |       1 | True     |

## Error test: all OK

| case             | expected            | got                 | ok   |
|:-----------------|:--------------------|:--------------------|:-----|
| empty prompt     | 400 EMPTY_PROMPT    | 400 EMPTY_PROMPT    | True |
| prompt too long  | 400 PROMPT_TOO_LONG | 400 PROMPT_TOO_LONG | True |
| unknown mode     | 400 BAD_MODE        | 400 BAD_MODE        | True |
| blocked prompt   | 422 UNSAFE_PROMPT   | 422 UNSAFE_PROMPT   | True |
| not JSON         | 400 EMPTY_PROMPT    | 400 EMPTY_PROMPT    | True |
| unknown endpoint | 404 JSON error      | 404 INTERNAL        | True |

## Speed per mode (server time, no network)

| mode     |   avg_s |   p90_s |   max_s |   avg_tries |   passed |   avg_kb |   03a_replay_avg_s |   03a_live_avg_s |
|:---------|--------:|--------:|--------:|------------:|---------:|---------:|-------------------:|-----------------:|
| fast     |   1.475 |   1.615 |   1.692 |         1   |     0.35 |   17.621 |              1.277 |            1.929 |
| balanced |   3.424 |   5.146 |   5.242 |         2.1 |     0.65 |   30.175 |              2.982 |            3.926 |
| quality  |   3.105 |   4.139 |   4.199 |         1.5 |     0.65 |   34.13  |              3.087 |            4.592 |

## Several judges at once: {'requests': 6, 'status_codes': {200: 6}, 'fastest_s': 1.71, 'slowest_s': 19.05}

GPU memory of the server process: 4.13 GB

## Tested versions

```
torch==2.11.0
torchvision==0.26.0
diffusers==0.42.1
transformers==5.22.2
accelerate==1.15.0
bitsandbytes==0.50.2
sentencepiece==0.2.3
protobuf==7.36.2
opencv-python-headless==4.14.0.94
numpy==2.1.3
pillow==13.0.0
fastapi==0.162.0
uvicorn[standard]==0.54.0
```