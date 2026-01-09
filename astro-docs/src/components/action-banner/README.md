# ActionBanners

Use ActionBanners in articles and other places where you want to forward the user to a product or service.

## Usage

Create a new ActionBanner component for each service or product. Use HTML templates & web components to create the content and add the component to the page where you want it to appear, e.g. _src/pages/blog/[...slug].astro_ for a blog post. Then use the web component's tag in the page or content to render the component.

## Example

Create a new ActionBanner implementation, e.g. _src/components/action-banner/ExampleActionBanner.astro_:

```tsx
---
import ActionBanner from './ActionBanner.astro';
import Compass from '../../images/challenges/compass.svg';
---
<template id="example-action-banner-template">
  <ActionBanner action="Get Started" actionLink="/get-started" points={['easy', 'awesome', 'yay', 'FTW']} imgSrc={Compass.src}>
    <span slot="title">Hallo <span class="text-primary">Du</span> da</span>
  </ActionBanner>
</template>

<script>
  class ExampleActionBanner extends HTMLElement {
    connectedCallback() {
      const template = document.getElementById('example-action-banner-template') as HTMLTemplateElement;
      this.appendChild(template.content.cloneNode(true));
    }
  }
  customElements.define('q-example-banner', ExampleActionBanner);
</script>
```

Add it to the page and use it:

```tsx
---
import ExampleActionBanner from '../components/action-banner/ExampleActionBanner.astro';
---
<!-- add the template and webcomponent to the page -->
<ExampleActionBanner />

<!-- ... -->

<!-- The banner will be rendered here -->
<q-example-banner></q-example-banner>

<!-- ... -->
```
