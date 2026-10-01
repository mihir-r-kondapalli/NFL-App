import httpx
from nflsim.config import Settings
from nflsim.storage import SupabaseRepository


def test_local_and_cloud_return_same_records(local_repo):
    settings, local = local_repo
    remote = SupabaseRepository(
        Settings(settings.data_dir, "supabase", "https://example.invalid", "test-key")
    )
    assert remote.client.headers["Accept-Profile"] == "nflsim"
    remote.client.close()
    rows = local.rows("play_cdf", year=2030, team="PHI", is_defense=False, down=1)

    def transport(request):
        assert request.headers["apikey"] == "test-key"
        offset = int(request.url.params["offset"])
        return httpx.Response(200, json=rows[offset : offset + 1000])

    remote.client = httpx.Client(
        transport=httpx.MockTransport(transport),
        base_url="https://example.invalid/rest/v1/",
        headers={"apikey": "test-key"},
    )
    assert remote.rows("play_cdf", year=2030, team="PHI", is_defense=False, down=1) == rows
    assert len(rows) > 1000  # Proves the hosted adapter handles PostgREST pagination.
