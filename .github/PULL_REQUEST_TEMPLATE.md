## Member Card Request

Fill the block below between the markers. This PR will trigger a GitHub Action to create `src/content/members/<slug>.md` and download the image into `src/assets/members/` when possible.

<!-- MEMBER-INFO-START -->
```yaml
name: ""
role: ""
affiliation: ""
# EITHER a remote URL OR a local repo path under src/assets/members/
image: "https://avatars.githubusercontent.com/u/59738610?v=4"
website: ""
order: 100
```
<!-- MEMBER-INFO-END -->

### Checklist

- [ ] I consent to having my name, role, affiliation, and image listed on the site.
- [ ] If supplying a local image, I confirm I have added it under `src/assets/members/` and referenced it via a relative path.


